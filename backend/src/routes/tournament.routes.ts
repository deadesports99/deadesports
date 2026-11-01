import { Router } from 'express';
import * as tournamentController from '../controllers/tournament.controller.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Tournament Engine routes — mounted at /api/v1/tournaments
 *
 *  POST   /                    authenticated + canCreateMatch (admin/staff) -> create
 *  GET    /                    authenticated -> list (tenant-scoped, paginated)
 *  GET    /:id                 authenticated -> details + my slot
 *  GET    /:id/slots           authenticated -> seats with player IGN
 *  POST   /:id/join            authenticated + USER -> atomic slot booking
 *  POST   /:id/cancel          authenticated + ADMIN -> cancel + refund all
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
  tournamentController.joinTournament,
);

tournamentRouter.post(
  '/:id/cancel',
  authenticate,
  requireRole('ADMIN'),
  tournamentController.cancelTournamentAndRefundAll,
);