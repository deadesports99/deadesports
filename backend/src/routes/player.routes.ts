import { Router } from 'express';
import * as playerController from '../controllers/player.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

/**
 * Player profile routes — mounted at /api/v1/players
 *
 *  GET   /me/stats         authenticated -> career stats (matches, wins, kills, prize money)
 *  PATCH /me/game-profile  authenticated -> update inGameName and inGameUid
 */
export const playerRouter: Router = Router();
playerRouter.get('/me/stats', authenticate, playerController.getMyStats);
playerRouter.patch('/me/game-profile', authenticate, playerController.updateGameProfile);
