import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role, User } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { invalidateAuthCache } from '../middlewares/auth.middleware.js';
import { PERMISSION_KEYS, type PermissionsInput, type TokenPayload } from '../types/auth.js';
import { normalizePhoneNumber, verifyFirebaseGoogleToken, verifyFirebasePhoneToken } from './firebase.service.js';
import { allocatePlayerCode } from './identity.service.js';

/** Sign a JWT for a given identity (role included for cheap client-side checks). */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'freefire-tournament-api',
    audience: 'freefire-tournament-apps',
  });
}

/** Fields that must never leak out of the API (add secrets here as they appear). */
type UserRecord = User;

/** Secure scrypt password hashing with unique salt per user. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time password hash verification against timing attacks. */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Public projection of a User — balances are intentional: wallet pages
 * and the "me" endpoint need them.
 */
export function sanitizeUser(user: UserRecord) {
  const {
    id,
    tenantId,
    phoneNumber,
    email,
    name,
    inGameName,
    inGameUid,
    role,
    canCreateMatch,
    canUpdateRoomId,
    canDistributePrize,
    canManageWallet,
    adminId,
    depositBalance,
    winningBalance,
    isBanned,
    /** Auto-generated readable player ID, e.g. "APX-0001". */
    playerCode,
    deviceId,
    createdAt,
  } = user;

  return {
    id,
    tenantId,
    phoneNumber,
    email,
    name,
    inGameName,
    inGameUid,
    role,
    permissions: {
      canCreateMatch,
      canUpdateRoomId,
      canDistributePrize,
      canManageWallet,
    },
    adminId,
    depositBalance,
    winningBalance,
    isBanned,
    playerCode,
    deviceId,
    createdAt,
  };
}

async function assertTenantActive(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  if (!tenant.isActive) throw ApiError.forbidden('Tenant account is inactive');
}

async function assertPhoneFree(tenantId: string, phoneNumber: string): Promise<void> {
  const norm = normalizePhoneNumber(phoneNumber);
  const existing = await prisma.user.findFirst({
    where: {
      tenantId,
      phoneNumber: { in: [norm.national, norm.e164] },
    },
  });
  if (existing) throw ApiError.conflict('Phone number already registered');
}

/** Anti-multi-accounting rule: max 2 accounts per physical device. */
const MAX_ACCOUNTS_PER_DEVICE = 2;

/**
 * Anti-Multi-Accounting (Device Lock):
 * Maximum [MAX_ACCOUNTS_PER_DEVICE] accounts per physical device - enough for a
 * shared family phone, too few to farm accounts.
 *
 * The developer test-device whitelist and the `DEV_UNLIMITED_DEVICE_ACCOUNTS`
 * escape hatch were removed for launch (PRODUCTION_CLOUD_EXECUTION_PLAN V2-B).
 */
async function assertDeviceFree(tenantId: string, deviceId?: string): Promise<string | undefined> {
  if (!deviceId) return undefined;

  const trimmed = deviceId.trim();
  if (!trimmed) return undefined;

  const countOnDevice = await prisma.user.count({
    where: { tenantId, deviceId: trimmed, isBanned: false },
  });
  if (countOnDevice >= MAX_ACCOUNTS_PER_DEVICE) {
    throw ApiError.forbidden(
      'Tournament security: Maximum 2 accounts are allowed per physical mobile device.',
    );
  }
  return trimmed;
}

export interface RegisterPlayerInput {
  tenantId: string;
  phoneNumber?: string;
  idToken?: string;
  name?: string;
  inGameName?: string;
  inGameUid?: string;
  deviceId?: string;
}

/** Register a new gamer (role USER) for a tenant. */
export async function registerPlayer(data: RegisterPlayerInput): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowPhoneAuth: true },
  });
  if (tenant?.allowPhoneAuth === false) {
    throw ApiError.forbidden('Phone OTP authentication is currently disabled by administrator');
  }

  if (!data.idToken) {
    throw ApiError.badRequest('Firebase idToken is required for Phone OTP verification');
  }

  const verified = await verifyFirebasePhoneToken(data.idToken);
  const targetPhone = verified.national;


  const norm = normalizePhoneNumber(targetPhone);
  await assertPhoneFree(data.tenantId, norm.national);

  // Anti-Multi-Accounting: reject a 2nd active account on the same device.
  const deviceId = await assertDeviceFree(data.tenantId, data.deviceId);

  // A Free Fire UID must not be usable by two accounts inside the same tenant.
  if (data.inGameUid && data.inGameUid.trim()) {
    const existingUid = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, inGameUid: data.inGameUid.trim() },
    });
    if (existingUid) throw ApiError.conflict('This Free Fire UID is already registered');
  }

  const user = await prisma.user.create({
    data: {
      tenantId: data.tenantId,
      phoneNumber: norm.national,
      name: data.name?.trim() || null,
      inGameName: data.inGameName?.trim() || null,
      inGameUid: data.inGameUid?.trim() || null,
      playerCode: await allocatePlayerCode(data.tenantId),
      deviceId,
      role: 'USER',
    },
  });

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}

export interface GoogleAuthInput {
  tenantId: string;
  idToken: string;
  deviceId?: string;
  name?: string;
}

/** 1-Tap Google Sign-In: registers new players or logs in existing players seamlessly. */
export async function googleLoginOrRegister(
  data: GoogleAuthInput,
): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const verified = await verifyFirebaseGoogleToken(data.idToken);
  const email = verified.email;

  // Find user by email or by phone if phone matches
  let user = await prisma.user.findFirst({
    where: {
      tenantId: data.tenantId,
      email: email,
    },
  });

  if (!user) {
    // New player signing in with Google!
    // Anti-Multi-Accounting: reject a 2nd active account on the same device.
    const deviceId = await assertDeviceFree(data.tenantId, data.deviceId);

    // Fallback phone number for DB uniqueness constraint:
    const placeholderPhone = verified.phoneNumber
      ? normalizePhoneNumber(verified.phoneNumber).national
      : `G${verified.uid.slice(-9)}`;

    user = await prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: email,
        phoneNumber: placeholderPhone,
        name: data.name?.trim() || verified.name || 'Gamer',
        playerCode: await allocatePlayerCode(data.tenantId),
        deviceId,
        role: 'USER',
      },
    });
  } else {
    if (user.isBanned) throw ApiError.forbidden('Your account has been banned');
  }

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}

export interface LoginWithPhoneInput {
  tenantId: string;
  phoneNumber?: string;
  idToken?: string;
}

/** Login with phone or Firebase OTP — verifies account exists, returns fresh token. */
export async function loginWithPhone(data: LoginWithPhoneInput): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowPhoneAuth: true },
  });
  if (tenant?.allowPhoneAuth === false) {
    throw ApiError.forbidden('Phone OTP authentication is currently disabled by administrator');
  }

  if (!data.idToken) {
    throw ApiError.badRequest('Firebase idToken is required for Phone OTP verification');
  }

  const verified = await verifyFirebasePhoneToken(data.idToken);
  const targetPhone = verified.national;


  const norm = normalizePhoneNumber(targetPhone);
  const user = await prisma.user.findFirst({
    where: {
      tenantId: data.tenantId,
      phoneNumber: { in: [norm.national, norm.e164] },
    },
  });
  if (!user) throw ApiError.unauthorized('User not registered — please register first');
  if (user.isBanned) throw ApiError.forbidden('Your account has been banned');

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}

interface CreateStaffInput {
  name: string;
  email: string;
  phoneNumber: string;
  permissions?: PermissionsInput;
}

/** Minimal identity of the acting admin (what the auth middleware provides). */
export interface AdminIdentity {
  id: string;
  tenantId: string;
  role: Role;
}

/** ADMIN-only: hire a staff member (role SUB_ADMIN) under the admin. */
export async function createStaffMember(
  adminUser: AdminIdentity,
  data: CreateStaffInput,
): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  if (adminUser.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the admin can create staff members');
  }
  await assertTenantActive(adminUser.tenantId);
  await assertPhoneFree(adminUser.tenantId, data.phoneNumber);

  const normalizedPermissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, Boolean(data.permissions?.[key])]),
  ) as Record<(typeof PERMISSION_KEYS)[number], boolean>;

  // Email collision check (same tenant => same email not allowed).
  const emailTaken = await prisma.user.findFirst({
    where: { tenantId: adminUser.tenantId, email: data.email.toLowerCase().trim() },
  });
  if (emailTaken) throw ApiError.conflict('Email already in use by another account');

  const norm = normalizePhoneNumber(data.phoneNumber);
  const staff = await prisma.user.create({
    data: {
      tenantId: adminUser.tenantId,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phoneNumber: norm.national,
      playerCode: await allocatePlayerCode(adminUser.tenantId),
      role: 'SUB_ADMIN',
      adminId: adminUser.id,
      ...normalizedPermissions,
    },
  });

  const token = generateToken({ userId: staff.id, tenantId: staff.tenantId, role: staff.role });
  return { user: sanitizeUser(staff), token };
}

/** Full profile of the currently logged-in user (used by GET /auth/me). */
export async function getUserProfile(userId: string): Promise<ReturnType<typeof sanitizeUser>> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
}

/** Register the device's FCM push token against the user account. */
export async function saveFcmToken(userId: string, token: string): Promise<{ registered: boolean }> {
  if (!token || token.trim().length < 20) {
    throw ApiError.badRequest('Invalid FCM token');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: token.trim() },
  });
  return { registered: true };
}

// ─── ADMIN: STAFF (SUB_ADMIN) MANAGEMENT ─────────────────────────────────

/** Public projection of a staff member (also used by the admin staff console). */
export interface StaffMemberView {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string;
  role: Role;
  permissions: Record<(typeof PERMISSION_KEYS)[number], boolean>;
  isBanned: boolean;
  adminId: string | null;
  createdAt: Date;
}

function toStaffView(user: User): StaffMemberView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    permissions: {
      canCreateMatch: user.canCreateMatch,
      canUpdateRoomId: user.canUpdateRoomId,
      canDistributePrize: user.canDistributePrize,
      canManageWallet: user.canManageWallet,
    },
    isBanned: user.isBanned,
    adminId: user.adminId,
    createdAt: user.createdAt,
  };
}

/** ADMIN-only guard shared by every staff-management action. */
function assertAdmin(adminUser: AdminIdentity): void {
  if (adminUser.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the admin can manage staff members');
  }
}

/** Load a staff member that belongs to the admin's tenant (404 otherwise). */
async function requireTenantStaff(adminUser: AdminIdentity, staffId: string) {
  const staff = await prisma.user.findFirst({
    where: { id: staffId, tenantId: adminUser.tenantId, role: 'SUB_ADMIN' },
  });
  if (!staff) throw ApiError.notFound('Staff member not found');
  return staff;
}

/** ADMIN-only: every staff member hired by this tenant (active + deactivated). */
export async function listStaffMembers(adminUser: AdminIdentity): Promise<{ staff: StaffMemberView[]; count: number }> {
  assertAdmin(adminUser);

  const rows = await prisma.user.findMany({
    where: { tenantId: adminUser.tenantId, role: 'SUB_ADMIN' },
    orderBy: { createdAt: 'desc' },
  });
  const staff = rows.map(toStaffView);
  return { staff, count: staff.length };
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  permissions?: PermissionsInput;
  isActive?: boolean;
}

/**
 * ADMIN-only: update a staff member's granular permissions (and optionally
 * name/email). Permissions are also refreshed in the auth cache so the change
 * applies to the very next API call the staff member makes.
 */
export async function updateStaffMember(
  adminUser: AdminIdentity,
  staffId: string,
  data: UpdateStaffInput,
): Promise<StaffMemberView> {
  assertAdmin(adminUser);

  const staff = await requireTenantStaff(adminUser, staffId);

  if (data.email) {
    const email = data.email.toLowerCase().trim();
    const taken = await prisma.user.findFirst({
      where: { tenantId: adminUser.tenantId, email, NOT: { id: staff.id } },
    });
    if (taken) throw ApiError.conflict('Email already in use by another account');
  }

  const normalizedPermissions = data.permissions
    ? (Object.fromEntries(
        PERMISSION_KEYS.map((key) => [key, Boolean(data.permissions?.[key])]),
      ) as Record<(typeof PERMISSION_KEYS)[number], boolean>)
    : undefined;

  const updated = await prisma.user.update({
    where: { id: staff.id },
    data: {
      name: data.name?.trim() || undefined,
      email: data.email ? data.email.toLowerCase().trim() : undefined,
      isBanned: data.isActive === undefined ? undefined : !data.isActive,
      ...(normalizedPermissions ?? {}),
    },
  });

  invalidateAuthCache(updated.id);
  return toStaffView(updated);
}

/**
 * ADMIN-only: deactivate (soft delete) a staff member. The account can no
 * longer log in or call any API, but the historic ledger/audit rows stay
 * intact (a real DELETE would break `reviewedBy` trails).
 */
export async function removeStaffMember(
  adminUser: AdminIdentity,
  staffId: string,
): Promise<StaffMemberView> {
  assertAdmin(adminUser);

  const staff = await requireTenantStaff(adminUser, staffId);

  const updated = await prisma.user.update({
    where: { id: staff.id },
    data: {
      isBanned: true,
      canCreateMatch: false,
      canUpdateRoomId: false,
      canDistributePrize: false,
      canManageWallet: false,
    },
  });

  invalidateAuthCache(updated.id);
  return toStaffView(updated);
}

// ─── EMAIL + PASSWORD + OTP AUTHENTICATION ────────────────────────────────

export interface SendEmailOtpInput {
  tenantId: string;
  email: string;
  password?: string;
  name?: string;
  type: 'LOGIN' | 'REGISTER';
}

export interface VerifyEmailOtpInput {
  tenantId: string;
  email: string;
  code: string;
  password?: string;
  name?: string;
  deviceId?: string;
  type: 'LOGIN' | 'REGISTER';
}

/** Step 1: Validates credentials and sends a 6-digit verification code to the email. */
export async function sendEmailOtp(
  data: SendEmailOtpInput,
): Promise<{ message: string; email: string; debugOtp?: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowEmailAuth: true, brandName: true },
  });
  if (tenant?.allowEmailAuth === false) {
    throw ApiError.forbidden('Email authentication is currently disabled by administrator');
  }

  const normalizedEmail = data.email.toLowerCase().trim();

  if (data.type === 'REGISTER') {
    if (!data.password || data.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long');
    }
    const existing = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, email: normalizedEmail },
    });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists. Please login instead.');
    }
  } else {
    // LOGIN
    if (!data.password) {
      throw ApiError.badRequest('Password is required');
    }
    const user = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (user.isBanned) {
      throw ApiError.forbidden('Your account has been banned');
    }
    const valid = verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }
  }

  // Generate 6-digit random code (CSPRNG — never Math.random for OTPs)
  const code = crypto.randomInt(100_000, 1_000_000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete previous OTPs for this email in this tenant
  await prisma.emailOtp.deleteMany({
    where: { tenantId: data.tenantId, email: normalizedEmail },
  });

  await prisma.emailOtp.create({
    data: {
      tenantId: data.tenantId,
      email: normalizedEmail,
      code,
      type: data.type,
      expiresAt,
    },
  });

  console.log(`📧 [EMAIL OTP] Brand: ${tenant?.brandName} | To: ${normalizedEmail} | Type: ${data.type} | OTP: ${code}`);

  return {
    message: `6-digit verification code sent to ${normalizedEmail}`,
    email: normalizedEmail,
    debugOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

/** Step 2: Verifies the 6-digit OTP code and creates or logs into the account. */
export async function verifyEmailOtp(
  data: VerifyEmailOtpInput,
): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowEmailAuth: true },
  });
  if (tenant?.allowEmailAuth === false) {
    throw ApiError.forbidden('Email authentication is currently disabled by administrator');
  }

  const normalizedEmail = data.email.toLowerCase().trim();
  const now = new Date();

  const otp = await prisma.emailOtp.findFirst({
    where: {
      tenantId: data.tenantId,
      email: normalizedEmail,
      code: data.code.trim(),
      expiresAt: { gt: now },
    },
  });

  if (!otp) {
    throw ApiError.badRequest('Invalid or expired verification code');
  }

  // Delete the used OTP
  await prisma.emailOtp.delete({ where: { id: otp.id } });

  let user = await prisma.user.findFirst({
    where: { tenantId: data.tenantId, email: normalizedEmail },
  });

  if (data.type === 'REGISTER') {
    if (user) {
      throw ApiError.conflict('User already exists with this email');
    }
    if (!data.password || data.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    const deviceId = await assertDeviceFree(data.tenantId, data.deviceId);
    const passwordHash = hashPassword(data.password);
    const placeholderPhone = `E${Date.now().toString().slice(-9)}`;

    user = await prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: normalizedEmail,
        phoneNumber: placeholderPhone,
        passwordHash,
        name: data.name?.trim() || 'Gamer',
        playerCode: await allocatePlayerCode(data.tenantId),
        deviceId,
        role: 'USER',
      },
    });
  } else {
    // LOGIN
    if (!user) {
      throw ApiError.notFound('Account not found');
    }
    if (user.isBanned) {
      throw ApiError.forbidden('Your account has been banned');
    }
  }

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}
