import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { type Role } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { ADMIN_SESSION_COOKIE, readCookie } from '../utils/cookies.js';
import { assertAccessKeyUsable } from '../services/adminAuth.service.js';
import type { AuthUser, PermissionKey, TokenPayload } from '../types/auth.js';

interface CachedAuth {
  user: any;
  tenant: any;
  expiresAt: number;
}

const authCache = new Map<string, CachedAuth>();

export function invalidateAuthCache(userId?: string) {
  if (userId) authCache.delete(userId);
  else authCache.clear();
}

/**
 * CSRF gate for cookie sessions: state-changing requests must come from the
 * configured admin origin. Bearer-token (Android) requests skip this check.
 */
function assertCookieRequestOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;

  // `*` is a development-only CORS setting; do not weaken local testing.
  if (env.CORS_ORIGIN.includes('*')) return;

  const origin = (req.headers.origin ?? req.headers.referer ?? '').toString();
  if (!origin) throw ApiError.forbidden('Blocked cross-site request');

  const allowed = [env.ADMIN_WEB_ORIGIN, ...env.CORS_ORIGIN].filter((value) => value && value !== '*');
  const sameOrigin = allowed.some((base) => origin === base || origin.startsWith(`${base}/`));
  if (!sameOrigin) throw ApiError.forbidden('Blocked cross-site request');
}

/** Extract + verify the Bearer token, then load the fresh user from the DB. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Android: Authorization header. Admin web: httpOnly cookie (no token in JS).
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    const cookieToken = readCookie(req, ADMIN_SESSION_COOKIE);
    const fromCookie = !bearerToken && Boolean(cookieToken);
    const token = bearerToken || cookieToken;

    if (!token) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }

    if (fromCookie) assertCookieRequestOrigin(req);

    let payload: TokenPayload;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & Partial<TokenPayload>;
      if (!decoded.userId || !decoded.tenantId || !decoded.role) {
        throw new Error('Token payload incomplete');
      }
      payload = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
        ...(decoded.accessKeyId ? { accessKeyId: decoded.accessKeyId } : {}),
      };
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Staff sessions are bound to a permission key: revoking it kills the session.
    if (fromCookie && payload.accessKeyId) {
      await assertAccessKeyUsable(payload.accessKeyId);
    }

    // In-memory caching (30s TTL) eliminates 400ms sequential DB round trips on every request
    const cached = authCache.get(payload.userId);
    let user = cached?.user;
    let tenant = cached?.tenant;

    if (!cached || cached.expiresAt <= Date.now()) {
      user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) throw ApiError.unauthorized('User account no longer exists');

      if (user.tenantId !== payload.tenantId) {
        throw ApiError.unauthorized('Token tenant mismatch');
      }
      if (user.isBanned) throw ApiError.forbidden('Your account has been banned');

      tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
      if (!tenant || !tenant.isActive) throw ApiError.forbidden('Tenant account is inactive');

      authCache.set(payload.userId, {
        user,
        tenant,
        expiresAt: Date.now() + 30_000,
      });
    }

    req.user = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      canCreateMatch: user.canCreateMatch,
      canUpdateRoomId: user.canUpdateRoomId,
      canDistributePrize: user.canDistributePrize,
      canManageWallet: user.canManageWallet,
    } satisfies AuthUser;

    next();
  } catch (err) {
    next(err);
  }
}

/** Guard: the authenticated user must hold one of the allowed roles. */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      next(ApiError.forbidden('Access denied'));
      return;
    }
    next();
  };
}

/**
 * Guard: permission check for SUB_ADMIN staff.
 * - ADMIN passes unconditionally (owner has all permissions).
 * - SUB_ADMIN must have the specific permission flag = true.
 * - USER is always rejected.
 */
export function requirePermission(permissionKey: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

    if (user.role === 'ADMIN') {
      next();
      return;
    }

    if (user.role === 'SUB_ADMIN' && user[permissionKey] === true) {
      next();
      return;
    }

    next(ApiError.forbidden('You lack permission to perform this action'));
  };
}

/** Optional auth: attaches req.user if Bearer token is present & valid, otherwise proceeds without failing. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}