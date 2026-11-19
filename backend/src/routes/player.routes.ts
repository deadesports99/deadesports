import { Router } from 'express';
import * as playerController from '../controllers/player.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

/**
 * Player profile routes — mounted at /api/v1/players
 *
 *  GET   /me/stats         authenticated -> career stats (matches, wins, kills, prize money)
 *  GET   /me/matches       authenticated -> own match history (seat, result, refund, room)
 *  PATCH /me/game-profile  authenticated -> update inGameName and inGameUid
 */
export const playerRouter: Router = Router();
playerRouter.get('/me/stats', authenticate, playerController.getMyStats);
playerRouter.get('/me/matches', authenticate, playerController.getMyMatches);
playerRouter.patch('/me/game-profile', authenticate, playerController.updateGameProfile);
