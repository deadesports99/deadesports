import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as resultService from '../services/result.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Zod validation schemas ──────────────────────────────────────────────

const roomSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required').max(64),
  roomPassword: z.string().trim().min(1, 'roomPassword is required').max(64),
});

const payoutSchema = z.object({
  results: z
    .array(
      z.object({
        userId: z.string().min(1, 'userId is required'),
        verifiedKills: z.coerce.number().int().min(0).max(99),
        rank: z.coerce.number().int().min(1, 'rank must be >= 1').max(48),
        isDisqualified: z.boolean().optional(),
        disqualifyReason: z.string().trim().max(255).optional(),
      }),
    )
    .min(1, 'At least one verified result is required')
    .max(48, 'Max 48 results per payout'),
});

// ─── Handlers ────────────────────────────────────────────────────────────

export async function updateRoomCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = roomSchema.parse(req.body);
    const result = await resultService.updateRoomCredentials(
      req.user,
      String(req.params.id),
      body.roomId,
      body.roomPassword,
    );
    sendResponse(res, 200, 'Room credentials published', result);
  } catch (err) {
    next(err);
  }
}

export async function getRoomCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await resultService.getRoomCredentials(req.user, String(req.params.id));
    sendResponse(res, 200, 'Room credentials unlocked', result);
  } catch (err) {
    next(err);
  }
}

export async function getTournamentResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await resultService.getTournamentResults(req.user.tenantId, String(req.params.id));
    sendResponse(res, 200, 'Official scoreboard fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function distributeTournamentPrizes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { results } = payoutSchema.parse(req.body);
    const summary = await resultService.distributeTournamentPrizes(req.user, String(req.params.id), results);
    sendResponse(res, 200, 'Payout completed', summary);
  } catch (err) {
    next(err);
  }
}
