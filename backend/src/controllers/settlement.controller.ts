import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as settlementService from '../services/settlement.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Validation ──────────────────────────────────────────────────────────

const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .default(() => new Date().toISOString().slice(0, 10)),
});

// ─── Handlers ────────────────────────────────────────────────────────────

/** Owner-only daily financial summary (money in / money out / net margin). */
export async function getDailySettlement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { date } = dateQuerySchema.parse(req.query);
    const settlement = await settlementService.getDailySettlement(req.user.tenantId, date);
    sendResponse(res, 200, 'Daily settlement fetched', settlement);
  } catch (err) {
    next(err);
  }
}

/**
 * Owner-only CSV download of the day's full double-entry ledger, prefixed
 * with the settlement summary. Streamed as `text/csv` so the browser/app
 * saves it straight to a file.
 */
export async function exportSettlementCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { date } = dateQuerySchema.parse(req.query);
    const settlement = await settlementService.getDailySettlement(req.user.tenantId, date);
    const csv = settlementService.buildSettlementCsv(settlement);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="settlement-${date}.csv"`,
    );
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}
