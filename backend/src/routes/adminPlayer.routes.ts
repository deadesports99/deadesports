import { Router } from 'express';
import * as playerAdminController from '../controllers/playerAdmin.controller.js';
import * as deviceGroupController from '../controllers/deviceGroup.controller.js';
import * as deviceWatchController from '../controllers/deviceWatch.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

/**
 * Owner-only player management — mounted at /api/v1/admin/players.
 *
 *  GET   /            -> search players (Player ID / phone / IGN / FF UID)
 *  GET   /suspicious  -> ranked accounts worth a look (device farms, net-positive, spikes)
 *  GET   /devices     -> every device with 2+ accounts, ranked by risk
 *  GET   /devices/:deviceId -> all accounts on one device + where they met
 *  GET   /devices/:deviceId/export.csv -> the whole device as a spreadsheet
 *  PATCH /devices/:deviceId/ban -> ban/unban every account on the device
 *  GET   /watchlist   -> watched devices + pending new-account alerts
 *  POST  /watchlist   -> { deviceId, note? } start watching a device
 *  DELETE /watchlist/:deviceId -> stop watching
 *  PATCH /watchlist/:deviceId/ack -> admin reviewed, clear alerts
 *  GET   /:id         -> full player detail (match history, rewards, cheat signals)
 *  PATCH /:id/ban     -> { isBanned: true|false } (instant session invalidation)
 */
export const adminPlayerRouter: Router = Router();

adminPlayerRouter.use(authenticate, requireRole('ADMIN'));

adminPlayerRouter.get('/', playerAdminController.listPlayers);
// Static paths first — otherwise '/:id' would treat these as player ids.
adminPlayerRouter.get('/suspicious', playerAdminController.listSuspiciousPlayers);
adminPlayerRouter.get('/watchlist', deviceWatchController.listWatchlist);
adminPlayerRouter.post('/watchlist', deviceWatchController.watchDevice);
adminPlayerRouter.delete('/watchlist/:deviceId', deviceWatchController.unwatchDevice);
adminPlayerRouter.patch('/watchlist/:deviceId/ack', deviceWatchController.acknowledgeAlerts);
adminPlayerRouter.get('/devices', deviceGroupController.listDeviceGroups);
adminPlayerRouter.get('/devices/:deviceId/export.csv', deviceGroupController.exportDeviceCsv);
adminPlayerRouter.get('/devices/:deviceId', deviceGroupController.getDeviceGroup);
adminPlayerRouter.patch('/devices/:deviceId/ban', deviceGroupController.banDeviceAccounts);
adminPlayerRouter.get('/:id', playerAdminController.getPlayerDetail);
adminPlayerRouter.patch('/:id/ban', playerAdminController.setPlayerBanned);
