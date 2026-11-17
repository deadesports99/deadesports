import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as manageService from '../services/manageMatch.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const listQuerySchema = z.object({
  filter: z.enum(['live', 'upcoming', 'all', 'closed']).default('all'),
  q: z.string().trim().max(64).optional(),
});

const killsSchema = z.object({
  kills: z.number().int().min(0).max(99),
});

const doneSchema = z.object({
  done: z.boolean(),
});

const refundSchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

/** GET /admin/matches/manage — match rows + per-tab counts + search. */
export async function listManageMatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = listQuerySchema.parse(req.query);
    const result = await manageService.listManageMatches(req.user.tenantId, query.filter, query.q);
    sendResponse(res, 200, 'Manage matches fetched', result);
  } catch (error) {
    next(error);
  }
}

/** GET /admin/matches/:id/live-board — players, kills, done flags, payout preview. */
export async function getLiveBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const board = await manageService.getLiveBoard(req.user.tenantId, String(req.params.id));
    sendResponse(res, 200, 'Live board fetched', board);
  } catch (error) {
    next(error);
  }
}

/** PATCH /admin/matches/:id/participants/:userId/kills — absolute kill count. */
export async function setParticipantKills(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { kills } = killsSchema.parse(req.body);
    const board = await manageService.setPlayerKills(
      req.user,
      String(req.params.id),
      String(req.params.userId),
      kills,
    );
    sendResponse(res, 200, 'Kills updated', board);
  } catch (error) {
    next(error);
  }
}

/** POST /admin/matches/:id/participants/:userId/done — freeze a finished player. */
export async function setParticipantDone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { done } = doneSchema.parse(req.body);
    const board = await manageService.setPlayerDone(
      req.user,
      String(req.params.id),
      String(req.params.userId),
      done,
    );
    sendResponse(res, 200, done ? 'Player marked done' : 'Player restored', board);
  } catch (error) {
    next(error);
  }
}

/** POST /admin/matches/:id/participants/:userId/refund — refund one seat. */
export async function refundParticipant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { reason } = refundSchema.parse(req.body ?? {});
    const result = await manageService.refundParticipant(
      req.user,
      String(req.params.id),
      String(req.params.userId),
      reason,
    );
    sendResponse(res, 200, `Refunded ₹${result.refunded}`, result.board);
  } catch (error) {
    next(error);
  }
}