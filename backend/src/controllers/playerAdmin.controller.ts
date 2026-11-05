import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as playerAdminService from '../services/playerAdmin.service.js';
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
