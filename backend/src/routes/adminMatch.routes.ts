import { Router } from 'express';
import * as rosterController from '../controllers/matchRoster.controller.js';
import * as manageController from '../controllers/manageMatch.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

/**
 * Phase 12 — Admin match roster: reward, cheat signals & bans.
 * Mounted at /api/v1/admin/matches. Guarded by canDistributePrize
 * (ADMIN passes unconditionally; staff must be granted the permission).
 *
 *  GET   /:id/participants?search=&flagsOnly=   -> roster + flags + summary
 *  POST  /:id/payout                            -> { awards[], completeMatch }
 *  PATCH /:id/participants/:userId/ban          -> { isBanned, reason, banAccount }
 *  GET   /:id/participants/export.csv           -> downloadable roster (CSV)
 */
export const adminMatchRouter: Router = Router();

adminMatchRouter.use(authenticate, requirePermission('canDistributePrize'));

adminMatchRouter.get('/:id/participants', rosterController.getMatchRoster);
adminMatchRouter.get('/:id/participants/export.csv', rosterController.exportMatchRosterCsv);
adminMatchRouter.post('/:id/payout', rosterController.payoutMatchAwards);
adminMatchRouter.patch('/:id/participants/:userId/ban', rosterController.banMatchParticipant);

/**
 * Manage Matches — the single control room.
 * Mounted on the same prefix but with its own guards, because browsing and
 * scoring are operational (canCreateMatch) while paying and refunding are not
 * (canDistributePrize). Registered before the roster router so `/manage` can
 * never be mistaken for a match id.
 */
export const adminMatchControlRouter: Router = Router();

adminMatchControlRouter.use(authenticate);

adminMatchControlRouter.get(
  '/manage',
  requirePermission('canCreateMatch'),
  manageController.listManageMatches,
);

adminMatchControlRouter.get(
  '/:id/live-board',
  requirePermission('canCreateMatch'),
  manageController.getLiveBoard,
);

adminMatchControlRouter.patch(
  '/:id/participants/:userId/kills',
  requirePermission('canCreateMatch'),
  manageController.setParticipantKills,
);

adminMatchControlRouter.post(
  '/:id/participants/:userId/done',
  requirePermission('canCreateMatch'),
  manageController.setParticipantDone,
);

adminMatchControlRouter.post(
  '/:id/participants/:userId/refund',
  requirePermission('canDistributePrize'),
  manageController.refundParticipant,
);
