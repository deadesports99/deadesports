import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as resultService from '../services/result.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Zod validation schemas ──────────────────────────────────────────────

const roomSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required').max(64),
  roomPassword: z.string().trim().min(1, 'roomPassword is required').max(64),
  /** true = ignore the countdown and show the credentials to players right now. */
  revealNow: z.boolean().optional(),
});

/** Admin controls WHEN players see the Room ID & Password. */
const roomRevealSchema = z
  .object({
    /** Auto-reveal window in minutes before match start (1..10080). */
    roomRevealMinutes: z
      .number({ error: 'roomRevealMinutes must be a number' })
      .int('roomRevealMinutes must be a whole number')
      .min(1, 'roomRevealMinutes must be at least 1 minute')
      .max(10080, 'roomRevealMinutes cannot exceed 10080 minutes (7 days)')
      .optional(),
    /** Reveal to players immediately instead of waiting for the window. */
    revealNow: z.boolean().optional(),
  })
  .refine((body) => body.roomRevealMinutes !== undefined || body.revealNow !== undefined, {
    message: 'Provide roomRevealMinutes and/or revealNow',
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
      body.revealNow ?? false,
    );
    sendResponse(res, 200, 'Room credentials published', result);
  } catch (err) {
    next(err);
  }
}

/** Admin chooses the reveal window and/or reveals the room to players now. */
export async function updateRoomReveal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = roomRevealSchema.parse(req.body);
    const result = await resultService.updateRoomReveal(req.user, String(req.params.id), body);
    sendResponse(res, 200, 'Room reveal settings updated', result);
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
