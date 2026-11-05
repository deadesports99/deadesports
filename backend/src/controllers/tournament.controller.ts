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
  /** null/omitted = list immediately; N = hide from players until N hours before start. */
  visibilityHours: z
    .number({ error: 'visibilityHours must be a number or null' })
    .int('visibilityHours must be a whole number')
    .min(1, 'visibilityHours must be at least 1 hour')
    .max(336, 'visibilityHours cannot exceed 336 hours (14 days)')
    .nullable()
    .optional(),
  /** Admin-controlled Room ID & Password reveal window (minutes before start). */
  roomRevealMinutes: z
    .number({ error: 'roomRevealMinutes must be a number' })
    .int('roomRevealMinutes must be a whole number')
    .min(1, 'roomRevealMinutes must be at least 1 minute')
    .max(10080, 'roomRevealMinutes cannot exceed 10080 minutes (7 days)')
    .optional(),
});

const listQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'LIVE', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  /** Admin "Publish Room ID" picker: only upcoming/open matches, no stale ones. */
  publishable: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const joinSchema = z.object({
  slotNumber: z.coerce.number().int().min(1, 'slotNumber must be 1-48').max(48, 'slotNumber must be 1-48').optional(),
  teamCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'teamCode must be a 6-digit squad code')
    .optional(),
  inGameName: z
    .string()
    .trim()
    .min(2, 'In-game name must be at least 2 characters')
    .max(30, 'In-game name max 30 characters')
    .optional(),
  inGameUid: z
    .string()
    .trim()
    .regex(/^\d{6,12}$/, 'Free Fire UID must be 6-12 digits')
    .optional(),
  saveAsDefault: z.boolean().optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(5, 'A cancellation reason is required').max(300),
});

const cloneSchema = z.object({
  matchTime: z.coerce.date({ error: 'matchTime must be a valid ISO date' }),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100).optional(),
});

/** Player-feed visibility window: null = always listed, N = last N hours only. */
const visibilitySchema = z.object({
  visibilityHours: z
    .number({ error: 'visibilityHours must be a number or null' })
    .int('visibilityHours must be a whole number')
    .min(1, 'visibilityHours must be at least 1 hour')
    .max(336, 'visibilityHours cannot exceed 336 hours (14 days)')
    .nullable()
    .optional(),
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
    const result = await tournamentService.listTournaments(req.user.tenantId, query, req.user);
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
      body.inGameName,
      body.inGameUid,
      body.saveAsDefault,
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
 * Phase 7 — 1-tap clone: copy an existing tournament's format into a fresh
 * OPEN match at the given time (default title: "<original> (Next)").
 */
export async function cloneTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = cloneSchema.parse(req.body);
    const tournament = await tournamentService.cloneTournament(req.user, String(req.params.id), body);
    sendResponse(res, 201, 'Tournament cloned', tournament);
  } catch (err) {
    next(err);
  }
}

/**
 * Admin tunable player-feed visibility window: null = list immediately,
 * N = hide from players until N hours before match start.
 */
export async function updateTournamentVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = visibilitySchema.parse(req.body);
    const tournament = await tournamentService.updateTournamentVisibility(req.user, String(req.params.id), {
      visibilityHours: body.visibilityHours ?? null,
    });
    sendResponse(res, 200, 'Match visibility updated', tournament);
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
