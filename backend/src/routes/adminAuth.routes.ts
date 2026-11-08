import { Router } from 'express';
import * as adminAuthController from '../controllers/adminAuth.controller.js';
import * as adminAccessController from '../controllers/adminAccess.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { adminLoginLimiter, adminOtpRequestLimiter } from '../middlewares/rateLimiter.js';

/**
 * Admin web auth — mounted at /api/v1/auth/admin.
 *
 * The player auth router keeps its old paths untouched; web sessions live in an
 * httpOnly cookie while Android keeps using the Bearer token.
 */
export const adminAuthRouter: Router = Router();

adminAuthRouter.post('/otp/request', adminOtpRequestLimiter, adminAuthController.requestOtp);
adminAuthRouter.post('/otp/verify', adminLoginLimiter, adminAuthController.verifyOtp);
adminAuthRouter.post('/logout', authenticate, adminAuthController.logout);

/**
 * Owner-only staff permission keys — mounted at /api/v1/admin/access.
 * Every route is ADMIN-only (the requireRole guard is applied here once).
 */
export const adminAccessRouter: Router = Router();

adminAccessRouter.use(authenticate, requireRole('ADMIN'));
adminAccessRouter.get('/', adminAccessController.listKeys);
adminAccessRouter.post('/', adminAccessController.issueKey);
adminAccessRouter.post('/:id/revoke', adminAccessController.revokeKey);
adminAccessRouter.post('/:id/regenerate', adminAccessController.regenerateKey);
