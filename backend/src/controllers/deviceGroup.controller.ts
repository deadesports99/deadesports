import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as deviceGroupService from '../services/deviceGroup.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const listQuerySchema = z.object({
  minAccounts: z.coerce.number().int().min(2).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const banSchema = z.object({
  isBanned: z.boolean(),
});

/** GET /admin/players/devices — devices with 2+ accounts, ranked by risk. */
export async function listDeviceGroups(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = listQuerySchema.parse(req.query);
    const result = await deviceGroupService.listDeviceGroups(req.user.tenantId, query);
    sendResponse(res, 200, 'Device groups fetched', result);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/players/devices/:deviceId — every account on one device. */
export async function getDeviceGroup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await deviceGroupService.getDeviceGroup(
      req.user.tenantId,
      String(req.params.deviceId),
    );
    sendResponse(res, 200, 'Device group fetched', result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/players/devices/:deviceId/ban — ban or unban every account on the device. */
export async function banDeviceAccounts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = banSchema.parse(req.body);
    const result = await deviceGroupService.banDeviceAccounts(
      req.user.tenantId,
      String(req.params.deviceId),
      body.isBanned,
    );
    sendResponse(
      res,
      200,
      body.isBanned ? `${result.updated} account(s) banned` : `${result.updated} account(s) unbanned`,
      result,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /admin/players/devices/:deviceId/export.csv — the whole device as a file. */
export async function exportDeviceCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const deviceId = String(req.params.deviceId);
    const detail = await deviceGroupService.getDeviceGroup(req.user.tenantId, deviceId);
    const csv = deviceGroupService.buildDeviceCsv(detail);
    const label = deviceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'device';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="device-accounts-${label}.csv"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}
