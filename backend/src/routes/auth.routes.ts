import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Mounted at /api/v1/auth
 *
 * POST /auth/player/register   — public, gamer self signup
 * POST /auth/player/login      — public, phone login
 * POST /auth/admin/staff       — ADMIN only, hire staff
 * GET  /auth/me                — authenticated, own profile + permissions
 */
export const authRouter: Router = Router();

// Player endpoints (public)
authRouter.post('/player/register', authController.registerPlayer);
authRouter.post('/player/login', authController.loginWithPhone);

// ADMIN-only: staff management (owner hierarchy)
authRouter.post('/admin/staff', authenticate, requireRole('ADMIN'), authController.createStaffMember);

// Own profile (any authenticated role)
authRouter.get('/me', authenticate, authController.getMe);

// Device push token (any authenticated role)
authRouter.post('/fcm-token', authenticate, authController.registerFcmToken);