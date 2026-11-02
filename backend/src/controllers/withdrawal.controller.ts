import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as withdrawalService from '../services/withdrawal.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Player withdrawal request ───────────────────────────────────────────
const withdrawSchema = z.object({
  amount: z.coerce.number().positive('amount must be positive'),
  upiId: z.string().trim().min(3, 'upiId is required').max(300),
  deviceId: z.string().trim().max(255).optional(),
});

export async function requestWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = withdrawSchema.parse(req.body);
    const result = await withdrawalService.requestWithdrawal(
      req.user.userId,
      req.user.tenantId,
      body,
    );
    sendResponse(res, 201, 'Withdrawal request submitted for approval', result);
  } catch (err) {
    next(err);
  }
}

// ─── Admin wallet console ────────────────────────────────────────────────
const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export async function listWithdrawals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = listQuerySchema.parse(req.query);
    const result = await withdrawalService.listWithdrawals(req.user.tenantId, query.status);
    sendResponse(res, 200, 'Withdrawal requests fetched', result);
  } catch (err) {
    next(err);
  }
}

const approveSchema = z.object({
  utrNumber: z.string().trim().min(6, 'UTR number must be at least 6 characters').max(64),
});

export async function approveWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { utrNumber } = approveSchema.parse(req.body);
    const result = await withdrawalService.approveWithdrawal(
      req.user.userId,
      req.user.tenantId,
      String(req.params.id),
      utrNumber,
    );
    sendResponse(res, 200, result.message, result);
  } catch (err) {
    next(err);
  }
}

const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required').max(255),
});

export async function rejectWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { reason } = rejectSchema.parse(req.body);
    const result = await withdrawalService.rejectWithdrawal(
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