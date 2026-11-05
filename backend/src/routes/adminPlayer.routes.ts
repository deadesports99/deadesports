import { Router } from 'express';
import * as playerAdminController from '../controllers/playerAdmin.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Owner-only player management — mounted at /api/v1/admin/players.
 *
 *  GET   /            -> search players (Player ID / phone / IGN / FF UID)
 *  PATCH /:id/ban     -> { isBanned: true|false } (instant session invalidation)
 */
export const adminPlayerRouter: Router = Router();

adminPlayerRouter.use(authenticate, requireRole('ADMIN'));

adminPlayerRouter.get('/', playerAdminController.listPlayers);
adminPlayerRouter.patch('/:id/ban', playerAdminController.setPlayerBanned);
