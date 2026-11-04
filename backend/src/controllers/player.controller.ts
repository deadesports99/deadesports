import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import * as playerService from '../services/player.service.js';

const updateGameProfileSchema = z.object({
  inGameName: z
    .string()
    .trim()
    .min(2, 'In-game name must be at least 2 characters')
    .max(30, 'In-game name max 30 characters'),
  inGameUid: z.string().trim().regex(/^\d{6,12}$/, 'Free Fire UID must be 6-12 digits'),
});

/** GET /players/me/stats — career stats for the Profile tab. */
export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const stats = await playerService.getPlayerStats(req.user.userId, req.user.tenantId);
    sendResponse(res, 200, 'Player stats fetched', stats);
  } catch (err) {
    next(err);
  }
}

/** PATCH /players/me/game-profile — update Free Fire IGN and UID. */
export async function updateGameProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const body = updateGameProfileSchema.parse(req.body);
    const updated = await playerService.updateGameProfile(req.user.userId, req.user.tenantId, body);
    sendResponse(res, 200, 'Game profile updated successfully', updated);
  } catch (err) {
    next(err);
  }
}
