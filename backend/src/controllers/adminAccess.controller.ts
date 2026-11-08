import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as adminAuthService from '../services/adminAuth.service.js';

/**
 * Owner-only staff access-key management.
 * Mounted at /api/v1/admin/access (authenticate + requireRole('ADMIN')).
 */

const permissionsSchema = z
  .object({
    canCreateMatch: z.boolean().optional(),
    canUpdateRoomId: z.boolean().optional(),
    canDistributePrize: z.boolean().optional(),
    canManageWallet: z.boolean().optional(),
  })
  .strict();

const issueSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().email('Enter a valid email address'),
    phoneNumber: z.string().trim().regex(/^\+?\d{10,15}$/, 'Enter a valid phone number'),
    permissions: permissionsSchema.optional(),
  })
  .strict();

function owner(req: Request): { userId: string; tenantId: string } {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return { userId: req.user.userId, tenantId: req.user.tenantId };
}

/** GET /admin/access — keys + staff + status for the owner console. */
export async function listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await adminAuthService.listStaffAccess(owner(req).tenantId);
    sendResponse(res, 200, 'Access keys fetched', { keys: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
}

/** POST /admin/access — create/re-invite a sub-admin, returns the key ONCE. */
export async function issueKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = issueSchema.parse(req.body);
    const result = await adminAuthService.issueStaffAccess(owner(req), body, { ip: req.ip });

    sendResponse(res, 201, 'Permission key generated — copy it now, it is shown once', {
      accessKey: result.accessKey,
      keyId: result.keyId,
      keyHint: result.keyHint,
      expiresAt: result.expiresAt,
      staff: result.staff,
    });
  } catch (error) {
    next(error);
  }
}

/** POST /admin/access/:id/revoke — kills login + any existing session. */
export async function revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const keyId = z.string().min(1).parse(req.params.id);
    await adminAuthService.revokeStaffAccess(owner(req), keyId, { ip: req.ip });
    sendResponse(res, 200, 'Permission key revoked');
  } catch (error) {
    next(error);
  }
}

/** POST /admin/access/:id/regenerate — revoke old, return a fresh key once. */
export async function regenerateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const keyId = z.string().min(1).parse(req.params.id);
    const result = await adminAuthService.regenerateStaffAccess(owner(req), keyId, { ip: req.ip });

    sendResponse(res, 200, 'New permission key generated — copy it now, it is shown once', {
      accessKey: result.accessKey,
      keyId: result.keyId,
      keyHint: result.keyHint,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}
