import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as tournamentService from '../services/tournament.service.js';
import * as matchSweepService from '../services/matchSweep.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Zod validation schemas ──────────────────────────────────────────────

const createTournamentSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  gameMode: z.enum(['BATTLE_ROYALE', 'CLASH_SQUAD']),
  matchType: z.enum(['SOLO', 'DUO', 'SQUAD']),
  mapType: z.enum(['BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA']),
  entryFee: z.coerce.number().nonnegative('entryFee cannot be negative'),
  prizePool: z.coerce.number().nonnegative('prizePool cannot be negative'),
  perKillPrize: z.coerce.number().nonnegative('perKillPrize cannot be negative').optional(),
  matchTime: z.coerce.date({ error: 'matchTime must be a valid ISO date' }),
  totalSlots: z.coerce.number().int().min(1).max(48).optional(),
});

const listQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'LIVE', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const joinSchema = z.object({
  slotNumber: z.coerce.number().int().min(1, 'slotNumber must be 1-48').max(48, 'slotNumber must be 1-48'),
  teamCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'teamCode must be a 6-digit squad code')
    .optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(5, 'A cancellation reason is required').max(300),
});

// ─── Handlers ────────────────────────────────────────────────────────────

export async function createTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = createTournamentSchema.parse(req.body);
    const tournament = await tournamentService.createTournament(req.user, body);
    sendResponse(res, 201, 'Tournament created', tournament);
  } catch (err) {
    next(err);
  }
}

export async function listTournaments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = listQuerySchema.parse(req.query);
    const result = await tournamentService.listTournaments(req.user.tenantId, query);
    sendResponse(res, 200, 'Tournaments fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function getTournamentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const tournament = await tournamentService.getTournamentDetails(
      req.user.tenantId,
      String(req.params.id),
      req.user,
    );
    sendResponse(res, 200, 'Tournament fetched', tournament);
  } catch (err) {
    next(err);
  }
}

export async function getTournamentSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const slots = await tournamentService.getTournamentSlots(req.user.tenantId, String(req.params.id));
    sendResponse(res, 200, 'Slots fetched', slots);
  } catch (err) {
    next(err);
  }
}

export async function joinTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = joinSchema.parse(req.body);
    const result = await tournamentService.joinTournament(
      req.user,
      String(req.params.id),
      body.slotNumber,
      body.teamCode,
    );
    sendResponse(res, 201, 'Slot booked successfully', result);
  } catch (err) {
    next(err);
  }
}

export async function cancelTournamentAndRefundAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { reason } = cancelSchema.parse(req.body);
    const result = await tournamentService.cancelTournamentAndRefundAll(req.user, String(req.params.id), reason);
    sendResponse(res, 200, 'Tournament cancelled and all players refunded', result);
  } catch (err) {
    next(err);
  }
}
/**
 * Time-based lifecycle sweep (manual trigger) — same engine the background
 * scheduler runs every minute. Useful for ops "advance now" during a demo.
 */
export async function sweepMatchStates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await matchSweepService.sweepMatchStates(new Date(), req.user.tenantId);
    sendResponse(res, 200, 'Match state sweep complete', result);
  } catch (err) {
    next(err);
  }
}
