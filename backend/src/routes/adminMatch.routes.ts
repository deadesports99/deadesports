import { Router } from 'express';
import * as rosterController from '../controllers/matchRoster.controller.js';
import * as manageController from '../controllers/manageMatch.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { requireStepUp } from '../middlewares/stepUp.middleware.js';

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

adminMatchRouter.use(authenticate);

// Viewing the roster is a Final Payout / scoring action; paying money is not.
adminMatchRouter.get(
  '/:id/participants',
  requirePermission(['canViewPayout', 'canDistributePrize', 'canManageMatch']),
  rosterController.getMatchRoster,
);
adminMatchRouter.get(
  '/:id/participants/export.csv',
  requirePermission(['canViewPayout', 'canDistributePrize', 'canManageMatch']),
  rosterController.exportMatchRosterCsv,
);
// Releasing REAL money — only the flag that is named after it.
adminMatchRouter.post(
  '/:id/payout',
  requirePermission('canDistributePrize'),
  requireStepUp('paying out prizes'),
  rosterController.payoutMatchAwards,
);
adminMatchRouter.patch(
  '/:id/participants/:userId/ban',
  requirePermission(['canManageMatch', 'canDistributePrize']),
  rosterController.banMatchParticipant,
);

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
  requirePermission('canManageMatch'),
  manageController.listManageMatches,
);

adminMatchControlRouter.get(
  '/:id/live-board',
  requirePermission('canManageMatch'),
  manageController.getLiveBoard,
);

adminMatchControlRouter.patch(
  '/:id/participants/:userId/kills',
  requirePermission('canManageMatch'),
  manageController.setParticipantKills,
);

adminMatchControlRouter.post(
  '/:id/participants/:userId/done',
  requirePermission('canManageMatch'),
  manageController.setParticipantDone,
);

adminMatchControlRouter.post(
  '/:id/participants/:userId/refund',
  requirePermission('canDistributePrize'),
  manageController.refundParticipant,
);

/**
 * Banned seat money switch (coin icon in the board).
 *
 * `refund: true`  -> entry fee back to the banned player (seat + ban stay)
 * `refund: false` -> no money, ban only (reverses a refund already given)
 */
adminMatchControlRouter.patch(
  '/:id/participants/:userId/ban-refund',
  requirePermission('canDistributePrize'),
  manageController.setBannedRefund,
);

/**
 * Submit = hand the scored match to the Final Payout desk (no money moves).
 * Scoring staff can do this; paying stays owner-gated with a step-up OTP.
 */
adminMatchControlRouter.post(
  '/:id/submit',
  requirePermission('canManageMatch'),
  manageController.submitForPayout,
);

/** Final Payout desk — every submitted match with its money totals. */
adminMatchControlRouter.get(
  '/payouts/inbox',
  requirePermission(['canViewPayout', 'canDistributePrize']),
  manageController.listPayouts,
);
