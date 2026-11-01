import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as walletService from '../services/wallet.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const walletQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function getWalletSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = walletQuerySchema.parse(req.query);
    const summary = await walletService.getWalletSummary(
      req.user.userId,
      req.user.tenantId,
      query.page,
      query.limit,
    );
    sendResponse(res, 200, 'Wallet fetched', summary);
  } catch (err) {
    next(err);
  }
}