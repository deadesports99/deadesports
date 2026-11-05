import { Router } from 'express';
import * as resultController from '../controllers/result.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

/**
 * Phase 4 — Room release + official spectator results + payout engine.
 * Mounted at /api/v1/tournaments (route prefix /:id).
 *
 *  PATCH /api/v1/tournaments/:id/room    canUpdateRoomId (admin/staff)  -> set room creds
 *  GET   /api/v1/tournaments/:id/room    authenticated                  -> timed reveal (T-15min)
 *  GET   /api/v1/tournaments/:id/results authenticated                  -> official spectator scoreboard
 *  POST  /api/v1/tournaments/:id/payout  canDistributePrize (staff)     -> 1-click winner payout
 */
export const resultRouter: Router = Router();

resultRouter.patch(
  '/:id/room',
  authenticate,
  requirePermission('canUpdateRoomId'),
  resultController.updateRoomCredentials,
);

// Phase 9 — admin decides WHEN the room credentials become visible
// (auto reveal N minutes before start, or reveal to players right now).
resultRouter.patch(
  '/:id/room-reveal',
  authenticate,
  requirePermission('canUpdateRoomId'),
  resultController.updateRoomReveal,
);

resultRouter.get('/:id/room', authenticate, resultController.getRoomCredentials);

// Official scoreboard (published by Spectator - no player fake screenshots)
resultRouter.get('/:id/results', authenticate, resultController.getTournamentResults);

// Spectator/Staff official 1-click payout
resultRouter.post(
  '/:id/payout',
  authenticate,
  requirePermission('canDistributePrize'),
  resultController.distributeTournamentPrizes,
);

// Phase 12 — admin one-click "End Match & Pay Winner by UID":
// enters the winner's Free Fire UID, credits rank-1 prize and completes the match.
resultRouter.post(
  '/:id/finish',
  authenticate,
  requirePermission('canDistributePrize'),
  resultController.finishMatchAndPayWinner,
);
