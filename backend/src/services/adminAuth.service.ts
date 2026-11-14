import jwt from 'jsonwebtoken';
import type { User } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  accessKeyHint,
  formatAccessKey,
  generateOtpCode,
  generateRawAccessKey,
  hashAccessKey,
  hashOtp,
  isWellFormedAccessKey,
  verifyOtpHash,
} from '../utils/accessKey.js';
import { PERMISSION_KEYS, type PermissionsInput } from '../types/auth.js';
import { sendAdminOtpEmail } from './email.service.js';
import { writeAuditLog } from './audit.service.js';
import { allocatePlayerCode } from './identity.service.js';

/**
 * ─── Admin web authentication ─────────────────────────────────────────────
 *
 * Owner (ADMIN):   email -> OTP (same inbox) -> session
 * Sub-admin:       owner email + 24-char permission key -> OTP (owner inbox)
 *                  -> session bound to the key owner's identity
 *
 * The permission key is the identity. It is stored only as an HMAC hash and can
 * be revoked at any time; a revoked key kills the existing web session too.
 */

const GENERIC_ERROR = 'Invalid email, permission key or code';
const GENERIC_SENT = 'If this email has access, a sign-in code has been sent.';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_KEY_TTL_DAYS = 90;

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string | null;
  email: string | null;
  phoneNumber: string;
  playerCode: string | null;
  role: 'ADMIN' | 'SUB_ADMIN' | 'USER';
  permissions: {
    canCreateMatch: boolean;
    canUpdateRoomId: boolean;
    canDistributePrize: boolean;
    canManageWallet: boolean;
  };
}

/** Session projection — never leaks hashes, balances or internal flags. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    playerCode: user.playerCode,
    role: user.role,
    permissions: {
      canCreateMatch: user.canCreateMatch,
      canUpdateRoomId: user.canUpdateRoomId,
      canDistributePrize: user.canDistributePrize,
      canManageWallet: user.canManageWallet,
    },
  };
}

// ─── Revoked-key cache ────────────────────────────────────────────────────
// Checked on every cookie session request. Revoking clears the entry so the
// very next request fails, even though the JWT itself is still valid.

interface KeyState {
  usable: boolean;
  expiresAt: number;
}

const keyStateCache = new Map<string, KeyState>();

export function invalidateAccessKeyCache(keyId?: string): void {
  if (keyId) keyStateCache.delete(keyId);
  else keyStateCache.clear();
}

/** Throws 401 when the session's permission key was revoked or expired. */
export async function assertAccessKeyUsable(keyId: string): Promise<void> {
  const cached = keyStateCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.usable) throw ApiError.unauthorized('Your permission key is no longer active');
    return;
  }

  const key = await prisma.staffAccessKey.findUnique({ where: { id: keyId } });
  const usable =
    Boolean(key) && !key!.revokedAt && (!key!.expiresAt || key!.expiresAt.getTime() > Date.now());

  keyStateCache.set(keyId, { usable, expiresAt: Date.now() + 30_000 });
  if (!usable) throw ApiError.unauthorized('Your permission key is no longer active');
}

// ─── Login ────────────────────────────────────────────────────────────────

async function findLoginEmailUser(email: string, tenantId?: string): Promise<User | null> {
  const where: Record<string, unknown> = {
    email,
    role: { in: ['ADMIN', 'SUB_ADMIN'] },
    isBanned: false,
  };
  if (tenantId) where.tenantId = tenantId;

  const user = await prisma.user.findFirst({
    where: where as never,
    orderBy: { createdAt: 'asc' },
  });
  return user ?? null;
}

/** Resolves a typed permission key to its sub-admin identity. */
async function resolveAccessKey(accessKey: string): Promise<{ keyId: string; user: User; tenantId: string }> {
  if (!isWellFormedAccessKey(accessKey)) throw ApiError.unauthorized(GENERIC_ERROR);

  const key = await prisma.staffAccessKey.findUnique({
    where: { keyHash: hashAccessKey(accessKey) },
  });
  if (!key || key.revokedAt) throw ApiError.unauthorized(GENERIC_ERROR);
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) throw ApiError.unauthorized(GENERIC_ERROR);

  const user = await prisma.user.findUnique({ where: { id: key.userId } });
  if (!user || user.isBanned || user.role !== 'SUB_ADMIN') throw ApiError.unauthorized(GENERIC_ERROR);

  return { keyId: key.id, user, tenantId: key.tenantId };
}

/**
 * Step 1 — validates the email (and the staff key when present) then emails a
 * 6-digit code to the OWNER inbox. Unknown emails get the same generic reply.
 */
export async function requestAdminOtp(input: {
  email: string;
  accessKey?: string;
  tenantId?: string;
  ip?: string;
}): Promise<{
  message: string;
  expiresInSeconds: number;
  requiresKey: boolean;
  debugOtp?: string;
}> {
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('Enter a valid email address');
  }

  const signedInUser = await findLoginEmailUser(email, input.tenantId);

  // Staff login needs BOTH the owner's email and the permission key.
  let identity: User | null = null;
  if (input.accessKey) {
    const resolved = await resolveAccessKey(input.accessKey);
    // The typed email must be an ADMIN of the same tenant (the owner inbox).
    if (!signedInUser || signedInUser.role !== 'ADMIN' || signedInUser.tenantId !== resolved.tenantId) {
      throw ApiError.unauthorized(GENERIC_ERROR);
    }
    identity = resolved.user;
  } else {
    if (!signedInUser) {
      // Same wording + timing shape for unknown emails (no enumeration).
      return { message: GENERIC_SENT, expiresInSeconds: OTP_TTL_MS / 1000, requiresKey: false };
    }
    if (signedInUser.role === 'SUB_ADMIN') {
      throw ApiError.badRequest('A permission key is required for staff accounts');
    }
    identity = signedInUser;
  }

  const tenant = identity
    ? await prisma.tenant.findUnique({ where: { id: identity.tenantId } })
    : null;
  if (!tenant || !tenant.isActive) throw ApiError.forbidden('Tenant account is inactive');

  // Phase 6: rolling 24h cap per identity. The IP limiter (3/10min) cannot stop
  // a distributed or key-holding loop from burning the shared provider quota
  // (Brevo free = 300/day). Counted from the audit trail we already write.
  if (identity) {
    const sentInLastDay = await prisma.adminAuditLog.count({
      where: {
        tenantId: tenant.id,
        action: 'ADMIN_OTP_REQUESTED',
        targetId: identity.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (sentInLastDay >= env.ADMIN_OTP_DAILY_CAP) {
      throw new ApiError(
        429,
        'Daily sign-in code limit reached. Try again tomorrow, or use an existing session.',
      );
    }
  }

  const code = generateOtpCode();
  await prisma.emailOtp.deleteMany({ where: { tenantId: tenant.id, email } });
  await prisma.emailOtp.create({
    data: {
      tenantId: tenant.id,
      email,
      codeHash: hashOtp(code),
      type: 'ADMIN_LOGIN',
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  try {
    await sendAdminOtpEmail(email, code, tenant.brandName);
  } catch (error) {
    await prisma.emailOtp.deleteMany({ where: { tenantId: tenant.id, email } });
    console.error('✖ admin OTP email failed:', (error as Error).message);
    throw new ApiError(502, 'Could not send the sign-in code. Please try again.');
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorId: identity?.id ?? null,
    actorRole: identity?.role ?? null,
    action: 'ADMIN_OTP_REQUESTED',
    targetType: 'User',
    targetId: identity?.id ?? null,
    ip: input.ip ?? null,
  });

  return {
    message: GENERIC_SENT,
    expiresInSeconds: OTP_TTL_MS / 1000,
    requiresKey: Boolean(input.accessKey) || identity?.role === 'SUB_ADMIN',
    debugOtp: env.NODE_ENV === 'production' ? undefined : code,
  };
}

/**
 * Step 2 — verifies the OTP and issues a 12h session token.
 * With a permission key the session belongs to the key's sub-admin identity.
 */
export async function verifyAdminOtp(input: {
  email: string;
  otp: string;
  accessKey?: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ user: SessionUser; token: string }> {
  const email = input.email.toLowerCase().trim();
  const otp = input.otp.trim();
  if (!/^\d{6}$/.test(otp)) throw ApiError.badRequest('Enter the 6-digit code');

  const resolvedKey = input.accessKey ? await resolveAccessKey(input.accessKey) : null;
  const tenantId = resolvedKey
    ? resolvedKey.tenantId
    : (await findLoginEmailUser(email))?.tenantId;

  if (!tenantId) throw ApiError.unauthorized(GENERIC_ERROR);

  const row = await prisma.emailOtp.findFirst({
    where: { tenantId, email, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw ApiError.badRequest('The code is invalid or expired');

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many wrong codes — request a new one');
  }

  if (!verifyOtpHash(otp, row.codeHash)) {
    await prisma.emailOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest('The code is invalid or expired');
  }

  // Resolve WHO is logging in.
  let user: User | null;
  if (resolvedKey) {
    user = resolvedKey.user;
  } else {
    user = await findLoginEmailUser(email, tenantId);
    if (user?.role !== 'ADMIN') throw ApiError.unauthorized(GENERIC_ERROR);
  }
  if (!user || user.isBanned) throw ApiError.forbidden('Your account has been banned');

  await prisma.emailOtp.delete({ where: { id: row.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: input.ip ?? null },
  });
  if (resolvedKey) {
    await prisma.staffAccessKey.update({
      where: { id: resolvedKey.keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      ...(resolvedKey ? { accessKeyId: resolvedKey.keyId } : {}),
    },
    env.JWT_SECRET,
    {
      expiresIn: `${env.ADMIN_SESSION_TTL_HOURS}h`,
      issuer: 'freefire-tournament-api',
      audience: 'freefire-tournament-apps',
    },
  );

  await writeAuditLog({
    tenantId: user.tenantId,
    actorId: user.id,
    actorRole: user.role,
    action: 'ADMIN_LOGIN',
    targetType: 'User',
    targetId: user.id,
    meta: { via: resolvedKey ? 'staff-key' : 'owner-otp' },
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  return { user: toSessionUser(user), token };
}

// ─── Access key management (owner only) ───────────────────────────────────

export interface StaffAccessInput {
  name: string;
  email: string;
  phoneNumber: string;
  permissions?: PermissionsInput;
}

function normalizePermissions(input?: PermissionsInput): Record<string, boolean> {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, Boolean(input?.[key])]),
  ) as Record<string, boolean>;
}

/** Generates + stores one key row and returns the plain key ONCE. */
async function createKeyRow(
  tenantId: string,
  userId: string,
  createdBy: string,
  permissions: Record<string, boolean>,
): Promise<{ accessKey: string; keyId: string; keyHint: string; expiresAt: Date }> {
  const raw = generateRawAccessKey();
  const expiresAt = new Date(Date.now() + ACCESS_KEY_TTL_DAYS * 24 * 60 * 60 * 1000);

  const row = await prisma.staffAccessKey.create({
    data: {
      tenantId,
      userId,
      keyHash: hashAccessKey(raw),
      keyHint: accessKeyHint(raw),
      permissions: permissions as never,
      expiresAt,
      createdBy,
    },
  });

  return { accessKey: formatAccessKey(raw), keyId: row.id, keyHint: accessKeyHint(raw), expiresAt };
}

function permissionsOf(user: User): Record<string, boolean> {
  return {
    canCreateMatch: user.canCreateMatch,
    canUpdateRoomId: user.canUpdateRoomId,
    canDistributePrize: user.canDistributePrize,
    canManageWallet: user.canManageWallet,
  };
}

/** Owner creates (or re-invites) a sub-admin and receives a fresh permission key. */
export async function issueStaffAccess(
  owner: { userId: string; tenantId: string },
  input: StaffAccessInput,
  context: { ip?: string } = {},
): Promise<{
  accessKey: string;
  keyId: string;
  keyHint: string;
  expiresAt: Date;
  staff: SessionUser;
}> {
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Enter a valid email address');
  if (!input.name?.trim()) throw ApiError.badRequest('Staff name is required');
  const phoneNumber = input.phoneNumber.replace(/\D/g, '').slice(-10);
  if (phoneNumber.length !== 10) throw ApiError.badRequest('Enter a valid 10-digit phone number');

  const permissions = normalizePermissions(input.permissions);

  const emailOwner = await prisma.user.findFirst({ where: { tenantId: owner.tenantId, email } });
  if (emailOwner && emailOwner.role === 'ADMIN') {
    throw ApiError.conflict('That email belongs to the owner account');
  }

  const phoneOwner = await prisma.user.findFirst({
    where: { tenantId: owner.tenantId, phoneNumber },
  });
  if (phoneOwner && phoneOwner.email?.toLowerCase() !== email) {
    throw ApiError.conflict('That phone number is already used by another account');
  }

  let staff = emailOwner;
  if (staff) {
    if (staff.role !== 'SUB_ADMIN') throw ApiError.conflict('That email belongs to a player account');
    staff = await prisma.user.update({
      where: { id: staff.id },
      data: { name: input.name.trim(), phoneNumber, isBanned: false, ...permissions },
    });
  } else {
    staff = await prisma.user.create({
      data: {
        tenantId: owner.tenantId,
        phoneNumber,
        email,
        name: input.name.trim(),
        role: 'SUB_ADMIN',
        adminId: owner.userId,
        playerCode: await allocatePlayerCode(owner.tenantId),
        ...permissions,
      },
    });
  }

  const created = await createKeyRow(owner.tenantId, staff.id, owner.userId, permissions);

  await writeAuditLog({
    tenantId: owner.tenantId,
    actorId: owner.userId,
    actorRole: 'ADMIN',
    action: 'STAFF_ACCESS_ISSUED',
    targetType: 'User',
    targetId: staff.id,
    meta: { keyId: created.keyId, keyHint: created.keyHint, permissions },
    ip: context.ip ?? null,
  });

  return { ...created, staff: toSessionUser(staff) };
}

export interface StaffAccessRow {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  playerCode: string | null;
  role: string;
  keyHint: string;
  permissions: Record<string, boolean>;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  isBanned: boolean;
}

/** Owner console list: every key + its sub-admin, newest first. */
export async function listStaffAccess(tenantId: string): Promise<StaffAccessRow[]> {
  const keys = await prisma.staffAccessKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  if (keys.length === 0) return [];

  const users = await prisma.user.findMany({ where: { tenantId } });
  const byId = new Map(users.map((user) => [user.id, user]));

  return keys.map((key) => {
    const user = byId.get(key.userId);
    const status: StaffAccessRow['status'] = key.revokedAt
      ? 'REVOKED'
      : key.expiresAt && key.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : 'ACTIVE';

    return {
      id: key.id,
      userId: key.userId,
      name: user?.name ?? null,
      email: user?.email ?? null,
      phoneNumber: user?.phoneNumber ?? null,
      playerCode: user?.playerCode ?? null,
      role: user?.role ?? 'SUB_ADMIN',
      keyHint: key.keyHint,
      permissions: (key.permissions ?? {}) as Record<string, boolean>,
      status,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      isBanned: Boolean(user?.isBanned),
    };
  });
}

/** Revokes a key; the sub-admin's existing session dies on the next request. */
export async function revokeStaffAccess(
  owner: { userId: string; tenantId: string },
  keyId: string,
  context: { ip?: string } = {},
): Promise<void> {
  const key = await prisma.staffAccessKey.findFirst({ where: { id: keyId, tenantId: owner.tenantId } });
  if (!key) throw ApiError.notFound('Access key not found');
  if (key.revokedAt) return;

  await prisma.staffAccessKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  invalidateAccessKeyCache(key.id);

  await writeAuditLog({
    tenantId: owner.tenantId,
    actorId: owner.userId,
    actorRole: 'ADMIN',
    action: 'STAFF_ACCESS_REVOKED',
    targetType: 'StaffAccessKey',
    targetId: key.id,
    meta: { userId: key.userId, keyHint: key.keyHint },
    ip: context.ip ?? null,
  });
}

/** Revokes the old key and returns a fresh one for the same sub-admin. */
export async function regenerateStaffAccess(
  owner: { userId: string; tenantId: string },
  keyId: string,
  context: { ip?: string } = {},
): Promise<{ accessKey: string; keyId: string; keyHint: string; expiresAt: Date }> {
  const key = await prisma.staffAccessKey.findFirst({ where: { id: keyId, tenantId: owner.tenantId } });
  if (!key) throw ApiError.notFound('Access key not found');

  const user = await prisma.user.findUnique({ where: { id: key.userId } });
  if (!user || user.role !== 'SUB_ADMIN') throw ApiError.notFound('Staff member not found');

  await prisma.staffAccessKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  invalidateAccessKeyCache(key.id);

  const permissions = permissionsOf(user);
  const created = await createKeyRow(owner.tenantId, user.id, owner.userId, permissions);

  await writeAuditLog({
    tenantId: owner.tenantId,
    actorId: owner.userId,
    actorRole: 'ADMIN',
    action: 'STAFF_ACCESS_REGENERATED',
    targetType: 'User',
    targetId: user.id,
    meta: { oldKeyId: key.id, keyId: created.keyId, keyHint: created.keyHint },
    ip: context.ip ?? null,
  });

  return created;
}

/** Used by tests / logout audit. */
export async function recordAdminLogout(user: {
  userId: string;
  tenantId: string;
  role: string;
}, context: { ip?: string } = {}): Promise<void> {
  await writeAuditLog({
    tenantId: user.tenantId,
    actorId: user.userId,
    actorRole: user.role,
    action: 'ADMIN_LOGOUT',
    ip: context.ip ?? null,
  });
}
