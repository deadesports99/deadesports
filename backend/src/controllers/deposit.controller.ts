import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as depositService from '../services/deposit.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Player: submit an "Add Cash" request ────────────────────────────────
const submitSchema = z.object({
  amount: z.coerce.number().positive('amount must be positive'),
  utrNumber: z
    .string()
    .trim()
    .regex(depositService.UTR_REGEX, 'UTR must be exactly 12 letters/digits'),
});

export async function submitDeposit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = submitSchema.parse(req.body);
    const result = await depositService.submitDeposit(req.user.userId, req.user.tenantId, body);
    sendResponse(res, 201, result.message, result);
  } catch (err) {
    next(err);
  }
}

// ─── Player: own deposit history ─────────────────────────────────────────
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function listMyDeposits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { limit } = listQuerySchema.parse(req.query);
    const result = await depositService.listPlayerDeposits(req.user.userId, req.user.tenantId, limit);
    sendResponse(res, 200, 'Deposit requests fetched', result);
  } catch (err) {
    next(err);
  }
}

// ─── Admin/staff: verification queue ─────────────────────────────────────
const adminListSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export async function listDeposits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = adminListSchema.parse(req.query);
    const result = await depositService.listDeposits(req.user.tenantId, query.status);
    sendResponse(res, 200, 'Deposit requests fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function approveDeposit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await depositService.approveDeposit(
      req.user.userId,
      req.user.tenantId,
      String(req.params.id),
    );
    sendResponse(res, 200, result.message, result);
  } catch (err) {
    next(err);
  }
}

const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required').max(255),
});

export async function rejectDeposit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { reason } = rejectSchema.parse(req.body);
    const result = await depositService.rejectDeposit(
      req.user.userId,
      req.user.tenantId,
      String(req.params.id),
      reason,
    );
    sendResponse(res, 200, result.message, result);
  } catch (err) {
    next(err);
  }
}
