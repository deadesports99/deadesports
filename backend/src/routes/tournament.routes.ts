import { Router } from 'express';
import * as tournamentController from '../controllers/tournament.controller.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import { joinSlotRateLimiter } from '../middlewares/rateLimiter.js';

/**
 * Tournament Engine routes — mounted at /api/v1/tournaments
 *
 *  POST   /                    authenticated + canCreateMatch (admin/staff) -> create
 *  GET    /                    authenticated -> list (tenant-scoped, paginated)
 *  GET    /:id                 authenticated -> details + my slot
 *  GET    /:id/slots           authenticated -> seats with player IGN
 *  POST   /:id/join            authenticated + USER -> atomic slot booking
 *  POST   /:id/cancel          authenticated + canCreateMatch -> cancel + refund all
 *  POST   /:id/clone           authenticated + canCreateMatch -> clone the match format
 *  PATCH  /:id/visibility      authenticated + canCreateMatch -> player-feed window
 *                              (null = list immediately, N = list only in the last N hours)
 *  POST   /sweep/states        authenticated + canCreateMatch -> run the time-based
 *                              lifecycle sweep now (T-15 reveal -> LIVE)
 */
export const tournamentRouter: Router = Router();

tournamentRouter.post(
  '/',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.createTournament,
);

tournamentRouter.get('/', authenticate, tournamentController.listTournaments);

tournamentRouter.get('/:id', authenticate, tournamentController.getTournamentDetails);

tournamentRouter.get('/:id/slots', authenticate, tournamentController.getTournamentSlots);

tournamentRouter.post(
  '/:id/join',
  authenticate,
  requireRole('USER'),
  joinSlotRateLimiter,
  tournamentController.joinTournament,
);

// Manual kickoff — organiser starts a specific match right now.
tournamentRouter.patch(
  '/:id/go-live',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.forceMatchLive,
);

tournamentRouter.post(
  '/sweep/states',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.sweepMatchStates,
);

tournamentRouter.post(
  '/:id/cancel',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.cancelTournamentAndRefundAll,
);

// Phase 7 — 1-tap clone (admin/staff with canCreateMatch).
tournamentRouter.post(
  '/:id/clone',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.cloneTournament,
);

// Phase 8 — player-feed visibility window (admin decides when the match lists).
tournamentRouter.patch(
  '/:id/visibility',
  authenticate,
  requirePermission('canCreateMatch'),
  tournamentController.updateTournamentVisibility,
);