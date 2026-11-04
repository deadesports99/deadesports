import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import * as tenantService from '../services/tenant.service.js';

const updateSettingsSchema = z
  .object({
    upiId: z.string().trim().min(3).max(320).optional(),
    upiName: z.string().trim().min(2).max(60).optional(),
    supportWhatsapp: z.string().trim().max(20).optional(),
    minDeposit: z.number().int().optional(),
  })
  .strict();

/** GET /tenant/settings — any logged-in user (drives the runtime QR/support). */
export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const settings = await tenantService.getTenantSettings(req.user.tenantId);
    sendResponse(res, 200, 'Tenant settings fetched', settings);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/tenant/settings — owner only (runtime UPI / WhatsApp update). */
export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const body = updateSettingsSchema.parse(req.body);
    const settings = await tenantService.updateTenantSettings(req.user.tenantId, body);
    sendResponse(res, 200, 'Settings saved — live in the Player app immediately', settings);
  } catch (err) {
    next(err);
  }
}
