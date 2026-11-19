import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as sessionService from '../services/adminSession.service.js';
import * as adminAuthService from '../services/adminAuth.service.js';
import { listAuditLogs } from '../services/audit.service.js';

/**
 * Admin security endpoints (mounted at /api/v1/admin/security).
 *
 *  GET   /sessions                → this account's signed-in browsers
 *  POST  /sessions/:id/revoke     → kill one browser
 *  POST  /sessions/revoke-others  → "log out other devices" (keeps this one)
 *  POST  /sessions/revoke-all     → "log out everywhere" (this one too)
 *  GET   /audit?limit=&action=    → owner-only admin activity trail
 */

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  action: z.string().trim().max(64).optional(),
});

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const sessions = await sessionService.listSessions(req.user.userId, req.sessionId);
    sendResponse(res, 200, 'Sessions fetched', {
      sessions,
      count: sessions.filter((session) => session.active).length,
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeOneSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const removed = await sessionService.revokeSession(
      req.user.userId,
      String(req.params.id),
      'revoked-by-user',
    );
    if (!removed) throw ApiError.notFound('Session not found');

    await adminAuthService.recordAdminLogout(
      { userId: req.user.userId, tenantId: req.user.tenantId, role: req.user.role },
      { ip: req.ip },
    );
    sendResponse(res, 200, 'Session signed out');
  } catch (error) {
    next(error);
  }
}

export async function revokeOtherSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    if (!req.sessionId) throw ApiError.badRequest('Only cookie sessions can do this');
    const count = await sessionService.revokeOtherSessions(req.user.userId, req.sessionId);
    sendResponse(res, 200, count > 0 ? `${count} other session(s) signed out` : 'No other sessions', {
      revoked: count,
    });
  } catch (error) {
    next(error);
  }
}

/** Nuclear option: bumps sessionVersion, so EVERY token of this account dies. */
export async function revokeAllSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const count = await sessionService.revokeAllSessions(req.user.userId, 'revoked-everywhere');
    sendResponse(res, 200, 'Signed out on all devices', { revoked: count });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const query = auditQuerySchema.parse(req.query);
    const rows = await listAuditLogs(req.user.tenantId, query);
    sendResponse(res, 200, 'Audit trail fetched', { rows, count: rows.length });
  } catch (error) {
    next(error);
  }
}
