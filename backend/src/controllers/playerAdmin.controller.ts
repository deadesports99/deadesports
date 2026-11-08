import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as playerAdminService from '../services/playerAdmin.service.js';
import * as suspicionService from '../services/suspicion.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const listQuerySchema = z.object({
  search: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const banSchema = z.object({
  isBanned: z.boolean(),
});

export async function listPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = listQuerySchema.parse(req.query);
    const result = await playerAdminService.listAdminPlayers(
      req.user.tenantId,
      query.search,
      query.limit,
    );
    sendResponse(res, 200, 'Players fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function setPlayerBanned(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = banSchema.parse(req.body);
    const result = await playerAdminService.setPlayerBanned(
      req.user.tenantId,
      String(req.params.id),
      body.isBanned,
    );
    sendResponse(res, 200, body.isBanned ? 'Player banned' : 'Player unbanned', result);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/players/:id — full profile, match history, cheat signals, linked accounts. */
export async function getPlayerDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await playerAdminService.getPlayerDetail(
      req.user.tenantId,
      String(req.params.id),
    );
    sendResponse(res, 200, 'Player detail fetched', result);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/players/suspicious — ranked list of accounts worth investigating. */
export async function listSuspiciousPlayers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const minScore = req.query.minScore ? Number(req.query.minScore) : 30;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await suspicionService.listSuspiciousPlayers(req.user.tenantId, {
      minScore: Number.isFinite(minScore) ? minScore : 30,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    sendResponse(res, 200, 'Suspicious players fetched', result);
  } catch (err) {
    next(err);
  }
}
