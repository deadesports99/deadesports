import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

/**
 * Mounted at /api/v1/auth
 *
 * POST   /auth/player/register   — public, gamer self signup
 * POST   /auth/player/login      — public, phone login
 * GET    /auth/admin/staff       — ADMIN only, list hired staff + permissions
 * POST   /auth/admin/staff       — ADMIN only, hire staff
 * PATCH  /auth/admin/staff/:id   — ADMIN only, update permissions / details
 * DELETE /auth/admin/staff/:id   — ADMIN only, deactivate staff (soft delete)
 * GET    /auth/me                — authenticated, own profile + permissions
 */
export const authRouter: Router = Router();

// Player endpoints (public) — brute-force protected (5/min/IP)
authRouter.post('/player/register', authRateLimiter, authController.registerPlayer);
authRouter.post('/player/login', authRateLimiter, authController.loginWithPhone);
authRouter.post('/player/google', authRateLimiter, authController.googleLogin);

// ADMIN-only: staff management (owner hierarchy)
authRouter.get('/admin/staff', authenticate, requireRole('ADMIN'), authController.listStaffMembers);
authRouter.post('/admin/staff', authenticate, requireRole('ADMIN'), authController.createStaffMember);
authRouter.patch('/admin/staff/:id', authenticate, requireRole('ADMIN'), authController.updateStaffMember);
authRouter.delete('/admin/staff/:id', authenticate, requireRole('ADMIN'), authController.removeStaffMember);

// Own profile (any authenticated role)
authRouter.get('/me', authenticate, authController.getMe);

// Device push token (any authenticated role)
authRouter.post('/fcm-token', authenticate, authController.registerFcmToken);