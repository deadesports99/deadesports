import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { liveFeedService } from '../services/liveFeed.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

/**
 * Live feed controller (Phase 2 — plan/firebase-migration/PHASE-2-LIVE-READER.md).
 *
 * `GET /api/v1/live/events?since=<epochMs>&limit=<n>`
 *
 * The client stores the `nextCursorMs` from the previous call and passes it back as
 * `since`. On the very first call it should send `since=Date.now() - 60000` (or 0)
 * to catch up on recent activity.
 *
 * Response `data.source` tells the client what happened:
 *   - `firestore`        → events are real, cursor advanced
 *   - `disabled`         → feature is off (or not configured); keep using /ws
 *   - `error`            → Firestore failed; keep using /ws, retry later
 *   - `budget_exhausted` → monthly read budget spent; 429 + Retry-After
 *
 * None of these are fatal for the app: the websocket is still the primary channel.
 */

const liveEventsQuerySchema = z.object({
  /** Cursor in epoch milliseconds. 0/absent = from the beginning of the feed. */
  since: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export async function getLiveEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const query = liveEventsQuerySchema.parse(req.query);

    const result = await liveFeedService.read(
      { userId: req.user.userId, tenantId: req.user.tenantId },
      query.since ?? 0,
      query.limit,
    );

    // Budget spent: tell the client how long to back off instead of silently
    // returning empty pages it would retry in a tight loop.
    if (result.source === 'budget_exhausted') {
      res.setHeader('Retry-After', '3600');
      res.setHeader('X-Live-Feed-Source', result.source);
      sendResponse(res, 429, 'Live feed paused for this billing period — use the live socket', result);
      return;
    }

    res.setHeader('X-Live-Feed-Source', result.source);
    res.setHeader('X-Live-Feed-Cursor', String(result.nextCursorMs));
    if (result.source !== 'firestore') {
      // An empty/degraded answer is cacheable: no point hammering us while it is off.
      res.setHeader('Cache-Control', 'private, max-age=5');
    }

    sendResponse(res, 200, result.events.length > 0 ? 'Live events' : 'No new live events', result);
  } catch (err) {
    next(err);
  }
}

/** `GET /api/v1/live/budget` — ops visibility on this tenant's read spend. */
export async function getLiveBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const budget = await liveFeedService.budget(req.user.tenantId);
    sendResponse(res, 200, 'Live feed read budget', {
      enabled: env.LIVE_FEED_ENABLED === 'true',
      ...budget,
    });
  } catch (err) {
    next(err);
  }
}
