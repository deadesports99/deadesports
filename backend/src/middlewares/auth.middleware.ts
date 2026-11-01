import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { type Role } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser, PermissionKey, TokenPayload } from '../types/auth.js';

/** Extract + verify the Bearer token, then load the fresh user from the DB. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw ApiError.unauthorized('Missing bearer token');
    }

    let payload: TokenPayload;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & Partial<TokenPayload>;
      if (!decoded.userId || !decoded.tenantId || !decoded.role) {
        throw new Error('Token payload incomplete');
      }
      payload = { userId: decoded.userId, tenantId: decoded.tenantId, role: decoded.role };
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Load the user fresh from the DB — keeps role/permissions/bans in sync
    // even if the admin toggled permissions without forcing a re-login.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) throw ApiError.unauthorized('User account no longer exists');

    if (user.tenantId !== payload.tenantId) {
      throw ApiError.unauthorized('Token tenant mismatch');
    }
    if (user.isBanned) throw ApiError.forbidden('Your account has been banned');

    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant || !tenant.isActive) throw ApiError.forbidden('Tenant account is inactive');

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