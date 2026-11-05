import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as paymentAdminService from '../services/paymentAdmin.service.js';
import { reconcilePaymentOrder } from '../services/payment.settlement.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Admin online-payments console (canManageWallet).
 *
 *  GET  /admin/wallet/payments          -> every online order + money summary
 *  POST /admin/wallet/payments/:id/sync -> ask the gateway what happened
 */

const listQuerySchema = z.object({
  status: z.enum(['ALL', 'CAPTURED', 'PENDING', 'FAILED', 'EXPIRED']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(100).default(30),
});

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

export async function listPayments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const query = listQuerySchema.parse(req.query);
    const data = await paymentAdminService.listAdminPayments(user.tenantId, query);
    sendResponse(res, 200, 'Online payments', data);
  } catch (err) {
    next(err);
  }
}

export async function syncPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const result = await reconcilePaymentOrder({
      tenantId: user.tenantId,
      orderId: String(req.params.id),
      paymentId: typeof req.body?.paymentId === 'string' ? req.body.paymentId : undefined,
    });

    const message =
      result.status === 'CAPTURED'
        ? result.alreadySettled
          ? 'Already captured — balance unchanged'
          : 'Payment captured & wallet credited'
        : 'Payment not captured yet';

    sendResponse(res, 200, message, result);
  } catch (err) {
    next(err);
  }
}
