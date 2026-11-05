import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import { authenticate, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Tenant settings — runtime branding + payment config.
 *
 *  GET   /api/v1/tenant/settings          any user (optional auth, query tenantId supported)
 *  GET   /api/v1/admin/tenant/settings    ADMIN -> same payload (owner console)
 *  PATCH /api/v1/admin/tenant/settings    ADMIN -> update UPI ID, payee name,
 *                                          WhatsApp support number, min deposit,
 *                                          and auth options (phoneAuth, directNumber, googleAuth)
 *
 * The Player app reads this on login/resume, so the client can rotate their
 * collecting UPI ID and auth methods from the Admin app without rebuilding or re-shipping APKs.
 */
export const tenantRouter: Router = Router();
tenantRouter.get('/settings', optionalAuth, tenantController.getSettings);

export const adminTenantRouter: Router = Router();
adminTenantRouter.get('/settings', authenticate, requireRole('ADMIN'), tenantController.getSettings);
adminTenantRouter.patch('/settings', authenticate, requireRole('ADMIN'), tenantController.updateSettings);
