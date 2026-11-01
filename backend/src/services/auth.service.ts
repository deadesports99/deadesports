import jwt from 'jsonwebtoken';
import type { Role, User } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { PERMISSION_KEYS, type PermissionsInput, type TokenPayload } from '../types/auth.js';

/** Sign a JWT for a given identity (role included for cheap client-side checks). */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    // JWT_EXPIRES_IN is a free-form duration string like "7d"/"24h" —
    // jsonwebtoken accepts it via the ms StringValue type.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'freefire-tournament-api',
    audience: 'freefire-tournament-apps',
  });
}

/** Fields that must never leak out of the API (add secrets here as they appear). */
type UserRecord = User;

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
  const existing = await prisma.user.findUnique({
    where: { tenantId_phoneNumber: { tenantId, phoneNumber } },
  });
  if (existing) throw ApiError.conflict('Phone number already registered');
}

interface RegisterPlayerInput {
  tenantId: string;
  phoneNumber: string;
  inGameName: string;
  inGameUid: string;
  deviceId?: string;
}

/** Register a new gamer (role USER) for a tenant. */
export async function registerPlayer(data: RegisterPlayerInput): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);
  await assertPhoneFree(data.tenantId, data.phoneNumber);

  // A Free Fire UID must not be usable by two accounts inside the same tenant.
  const existingUid = await prisma.user.findFirst({
    where: { tenantId: data.tenantId, inGameUid: data.inGameUid },
  });
  if (existingUid) throw ApiError.conflict('This Free Fire UID is already registered');

  const user = await prisma.user.create({
    data: {
      tenantId: data.tenantId,
      phoneNumber: data.phoneNumber,
      inGameName: data.inGameName.trim(),
      inGameUid: data.inGameUid.trim(),
      deviceId: data.deviceId,
      role: 'USER',
    },
  });

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}

interface LoginWithPhoneInput {
  tenantId: string;
  phoneNumber: string;
}

/** Login with phone — verifies the account exists, returns fresh token. */
export async function loginWithPhone(data: LoginWithPhoneInput): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const user = await prisma.user.findUnique({
    where: { tenantId_phoneNumber: { tenantId: data.tenantId, phoneNumber: data.phoneNumber } },
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

  const staff = await prisma.user.create({
    data: {
      tenantId: adminUser.tenantId,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phoneNumber: data.phoneNumber,
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