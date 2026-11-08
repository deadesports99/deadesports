import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as rosterService from '../services/matchRoster.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const rosterQuerySchema = z.object({
  search: z.string().trim().max(64).optional(),
  flagsOnly: z.enum(['flagged', 'noUid', 'banned', 'unpaid']).optional(),
});

const awardSchema = z.object({
  userId: z.string().uuid(),
  rank: z.number().int().min(1).max(99).nullable().optional(),
  kills: z.number().int().min(0).max(99).optional(),
  amount: z.number().min(0).max(10_000_000).optional(),
  isDisqualified: z.boolean().optional(),
  disqualifyReason: z.string().trim().max(255).optional(),
  note: z.string().trim().max(255).optional(),
});

const payoutSchema = z.object({
  awards: z.array(awardSchema).min(1).max(60),
  completeMatch: z.boolean().optional(),
});

const banSchema = z.object({
  isBanned: z.boolean(),
  reason: z.string().trim().max(255).optional(),
  banAccount: z.boolean().optional(),
});

export async function getMatchRoster(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = rosterQuerySchema.parse(req.query);
    const result = await rosterService.getMatchRoster(
      req.user,
      String(req.params.id),
      query.search,
      query.flagsOnly,
    );
    sendResponse(res, 200, 'Match roster fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function payoutMatchAwards(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = payoutSchema.parse(req.body);
    const result = await rosterService.payoutMatchAwards(
      req.user,
      String(req.params.id),
      body.awards,
      body.completeMatch === true,
    );
    sendResponse(res, 200, 'Prizes paid', result);
  } catch (err) {
    next(err);
  }
}

export async function banMatchParticipant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = banSchema.parse(req.body);
    const result = await rosterService.banMatchParticipant(
      req.user,
      String(req.params.id),
      String(req.params.userId),
      body.isBanned,
      body.reason,
      body.banAccount === true,
    );
    sendResponse(res, 200, body.isBanned ? 'Player banned' : 'Player unbanned', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/matches/:id/participants/export.csv
 * Downloads the full roster (identity snapshot + rewards + flags) as a CSV file.
 */
export async function exportMatchRosterCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const matchId = String(req.params.id);
    const roster = await rosterService.getMatchRoster(req.user, matchId);
    const csv = rosterService.buildRosterCsv(roster);
    const label = roster.match.matchNumber != null ? `match-${roster.match.matchNumber}` : 'match';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="roster-${label}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}
