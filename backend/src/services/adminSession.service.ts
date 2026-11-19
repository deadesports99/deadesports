import jwt from 'jsonwebtoken';
import type { AdminSession, Role, User } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * ─── Admin-web session store ──────────────────────────────────────────────
 *
 * The cookie is only a pointer. Every row here is one signed-in browser, so a
 * stolen cookie can be killed instantly (`revokedAt`) without rotating
 * JWT_SECRET or logging everyone out.
 *
 *   cookie JWT claims: { userId, tenantId, role, sid, sv, accessKeyId? }
 *     sid → AdminSession.id   (per-device kill switch)
 *     sv  → User.sessionVersion (kill-everywhere switch)
 *
 * Lifetime model:
 *   - idle window  : owner 7d, staff 24h (rolling — slides on activity)
 *   - absolute cap : owner 30d, staff 7d (never slides)
 *   - `expiresAt`  : absolute cap, fixed at creation
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Dead rows older than this are pruned on the next login of that user. */
const PRUNE_AFTER_MS = 7 * DAY_MS;
/** Don't hammer the DB with a lastSeenAt write on every single request. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export interface SessionPolicy {
  idleMs: number;
  maxMs: number;
}

export function policyForRole(role: Role | string): SessionPolicy {
  if (role === 'ADMIN') {
    return {
      idleMs: env.ADMIN_SESSION_TTL_HOURS * HOUR_MS,
      maxMs: env.ADMIN_SESSION_MAX_DAYS * DAY_MS,
    };
  }
  return {
    idleMs: env.ADMIN_STAFF_SESSION_HOURS * HOUR_MS,
    maxMs: env.ADMIN_STAFF_SESSION_MAX_DAYS * DAY_MS,
  };
}

/** Issues the signed cookie JWT for one session row. */
export function signAdminToken(
  user: Pick<User, 'id' | 'tenantId' | 'role' | 'sessionVersion'>,
  options: { sessionId: string; ttlMs: number; accessKeyId?: string },
): string {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      sid: options.sessionId,
      sv: user.sessionVersion,
      ...(options.accessKeyId ? { accessKeyId: options.accessKeyId } : {}),
    },
    env.JWT_SECRET,
    {
      expiresIn: Math.max(60, Math.floor(options.ttlMs / 1000)),
      issuer: 'freefire-tournament-api',
      audience: 'freefire-tournament-apps',
    },
  );
}

export interface IssuedSession {
  sessionId: string;
  token: string;
  expiresAt: Date;
  /** How long the cookie should live (the idle window, refreshed on activity). */
  cookieMaxAgeMs: number;
}

/** Creates the row + token for a fresh OTP login. */
export async function createAdminSession(
  user: User,
  context: { ip?: string; userAgent?: string; accessKeyId?: string } = {},
): Promise<IssuedSession> {
  const policy = policyForRole(user.role);
  const now = Date.now();

  // Opportunistic cleanup — keeps the table small without a cron job.
  try {
    await prisma.adminSession.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date(now - PRUNE_AFTER_MS) } },
          { revokedAt: { lt: new Date(now - PRUNE_AFTER_MS) } },
        ],
      },
    });
  } catch {
    /* cleanup is best-effort */
  }

  const row = await prisma.adminSession.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      ip: context.ip ?? null,
      userAgent: context.userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(now + policy.maxMs),
      revokedAt: null,
      revokedReason: null,
      lastSeenAt: new Date(now),
    },
  });

  // First token uses the idle window, capped by whatever the absolute cap allows.
  const ttlMs = Math.min(policy.idleMs, policy.maxMs);
  const token = signAdminToken(user, {
    sessionId: row.id,
    ttlMs,
    accessKeyId: context.accessKeyId,
  });

  return { sessionId: row.id, token, expiresAt: row.expiresAt, cookieMaxAgeMs: ttlMs };
}

/** Loads a live session row; 401s when it was revoked or ran past its cap. */
export async function getActiveSession(sessionId: string): Promise<AdminSession> {
  const session = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.unauthorized('This session no longer exists — sign in again');
  if (session.revokedAt) throw ApiError.unauthorized('This session was signed out — sign in again');
  if (session.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('This session expired — sign in again');
  }
  return session;
}

/**
 * Rolling renewal: once more than half of the idle window is gone, mint a fresh
 * token (and cookie) capped by the absolute expiry. Returns null when nothing
 * needs to change, so the caller can skip touching the response.
 */
export async function rollSession(
  user: Pick<User, 'id' | 'tenantId' | 'role' | 'sessionVersion'>,
  session: AdminSession,
  options: { tokenExpiresAtMs: number; accessKeyId?: string },
): Promise<{ token: string; cookieMaxAgeMs: number } | null> {
  const now = Date.now();
  const policy = policyForRole(user.role);
  const tokenRemainingMs = options.tokenExpiresAtMs - now;

  if (tokenRemainingMs > policy.idleMs * 0.5) return null;

  const absoluteRemainingMs = session.expiresAt.getTime() - now;
  if (absoluteRemainingMs <= 60_000) return null;

  const ttlMs = Math.min(policy.idleMs, absoluteRemainingMs);
  const token = signAdminToken(user, {
    sessionId: session.id,
    ttlMs,
    accessKeyId: options.accessKeyId,
  });

  await prisma.adminSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } })
    .catch(() => undefined);

  return { token, cookieMaxAgeMs: ttlMs };
}

/** Throttled "still here" timestamp for the Active devices list. */
export async function touchSession(session: AdminSession): Promise<void> {
  const lastSeen = session.lastSeenAt instanceof Date ? session.lastSeenAt.getTime() : 0;
  if (Date.now() - lastSeen < TOUCH_INTERVAL_MS) return;
  await prisma.adminSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}

// ─── Revocation ───────────────────────────────────────────────────────────

async function invalidateUserCache(userId: string): Promise<void> {
  const { invalidateAuthCache } = await import('../middlewares/auth.middleware.js');
  invalidateAuthCache(userId);
}

/** Kills one browser. `userId` scopes it, so one admin cannot revoke another's. */
export async function revokeSession(userId: string, sessionId: string, reason = 'signed-out'): Promise<boolean> {
  const result = await prisma.adminSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count > 0;
}

/** "Log out other devices" — keeps the caller signed in. */
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const result = await prisma.adminSession.updateMany({
    where: { userId, revokedAt: null, id: { not: keepSessionId } },
    data: { revokedAt: new Date(), revokedReason: 'revoked-from-another-device' },
  });
  return result.count;
}

/**
 * "Log out everywhere" — bumps `sessionVersion`, which invalidates every token
 * (including the caller's) on its next request, then revokes the rows so the
 * Active devices list is honest immediately.
 */
export async function revokeAllSessions(userId: string, reason = 'revoked-all'): Promise<number> {
  const [result] = await Promise.all([
    prisma.adminSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
    prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  await invalidateUserCache(userId);
  return result.count;
}

export interface AdminSessionRow {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  active: boolean;
}

/** Active devices for the current user, newest first, plus recent sign-outs. */
export async function listSessions(userId: string, currentSessionId?: string): Promise<AdminSessionRow[]> {
  const rows = await prisma.adminSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
    take: 40,
  });

  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    current: row.id === currentSessionId,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    active: !row.revokedAt && row.expiresAt.getTime() > now,
  }));
}
