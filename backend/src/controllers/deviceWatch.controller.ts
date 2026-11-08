import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as deviceWatchService from '../services/deviceWatch.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

const watchSchema = z.object({
  deviceId: z.string().trim().min(4).max(128),
  note: z.string().trim().max(200).optional(),
});

/** GET /admin/players/watchlist */
export async function listWatchlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await deviceWatchService.listWatchedDevices(req.user.tenantId);
    sendResponse(res, 200, 'Watchlist fetched', result);
  } catch (err) {
    next(err);
  }
}

/** POST /admin/players/watchlist — start watching a device. */
export async function watchDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const body = watchSchema.parse(req.body);
    const result = await deviceWatchService.watchDevice(
      req.user.tenantId,
      body.deviceId,
      body.note ?? null,
      req.user.userId,
    );
    sendResponse(res, 200, 'Device added to watchlist', result);
  } catch (err) {
    next(err);
  }
}

/** DELETE /admin/players/watchlist/:deviceId */
export async function unwatchDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await deviceWatchService.unwatchDevice(
      req.user.tenantId,
      String(req.params.deviceId),
    );
    sendResponse(res, 200, 'Device removed from watchlist', result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /admin/players/watchlist/:deviceId/ack — admin reviewed it, clear alerts. */
export async function acknowledgeAlerts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await deviceWatchService.acknowledgeAlerts(
      req.user.tenantId,
      String(req.params.deviceId),
    );
    sendResponse(res, 200, 'Alerts cleared', result);
  } catch (err) {
    next(err);
  }
}
