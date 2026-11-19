import { Router } from 'express';
import * as securityController from '../controllers/adminSecurity.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Security & audit console — mounted at /api/v1/admin/security.
 *
 * Session endpoints only ever touch the caller's own rows (the service scopes
 * the query by userId), so a staff account can sign out its own browsers but
 * never somebody else's. The audit feed is owner-only.
 */
export const adminSecurityRouter: Router = Router();

adminSecurityRouter.use(authenticate);

adminSecurityRouter.get('/sessions', securityController.getSessions);
adminSecurityRouter.post('/sessions/revoke-others', securityController.revokeOtherSessions);
adminSecurityRouter.post('/sessions/revoke-all', securityController.revokeAllSessions);
adminSecurityRouter.post('/sessions/:id/revoke', securityController.revokeOneSession);

adminSecurityRouter.get('/audit', requireRole('ADMIN'), securityController.getAuditLogs);
