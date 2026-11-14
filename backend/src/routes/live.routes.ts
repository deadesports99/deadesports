import { Router } from 'express';
import * as liveController from '../controllers/live.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.js';

/**
 * Live feed routes — mounted at /api/v1/live (Phase 2).
 *
 *  GET /events?since=<epochMs>&limit=<n>   authenticated -> catch-up feed
 *  GET /budget                             authenticated -> monthly read spend
 *
 * Poll budget: the client only needs this after a websocket reconnect, not on a
 * timer. The limiter is deliberately generous (60/min) so a reconnect storm after
 * a deploy still succeeds, while a runaway polling loop is stopped early.
 */
export const liveRouter: Router = Router();

export const liveFeedRateLimiter = createRateLimiter({
  name: 'live-feed',
  windowMs: 60_000,
  max: 60,
  key: (req) => req.user?.userId ?? req.ip ?? 'anonymous',
  message: 'Too many live feed requests — the websocket already has you covered.',
});

liveRouter.get('/events', authenticate, liveFeedRateLimiter, liveController.getLiveEvents);

liveRouter.get('/budget', authenticate, liveFeedRateLimiter, liveController.getLiveBudget);
