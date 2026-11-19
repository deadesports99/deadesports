import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import * as rewardController from '../controllers/reward.controller.js';

/**
 * Reward modules — mounted at /api/v1/rewards (player) and
 * /api/v1/admin/rewards (owner console).
 *
 *  GET   /summary              whole Rewards tab in one call
 *  POST  /daily-bonus/claim    one claim per IST day
 *  GET   /tasks                task list + derived progress
 *  POST  /tasks/:id/claim      credit a completed task
 *  GET   /referral             own code, invitees, earnings
 *  POST  /referral/apply       attach an inviter (one time)
 *
 * Owner console:
 *  GET   /settings             flags + numbers + task list
 *  PATCH /settings             flip modules / change amounts
 *  PATCH /tasks/:id            edit task copy, reward, visibility
 *  GET   /claims               recent payouts (audit)
 */
export const rewardRouter: Router = Router();
rewardRouter.get('/summary', authenticate, rewardController.getSummary);
rewardRouter.post('/daily-bonus/claim', authenticate, rewardController.claimDailyBonus);
rewardRouter.get('/tasks', authenticate, rewardController.listTasks);
rewardRouter.post('/tasks/:id/claim', authenticate, rewardController.claimTask);
rewardRouter.get('/referral', authenticate, rewardController.getReferral);
rewardRouter.post('/referral/apply', authenticate, rewardController.applyReferral);

export const adminRewardRouter: Router = Router();
adminRewardRouter.get('/settings', authenticate, requireRole('ADMIN'), rewardController.getAdminSettings);
adminRewardRouter.patch('/settings', authenticate, requireRole('ADMIN'), rewardController.updateAdminSettings);
adminRewardRouter.patch('/tasks/:id', authenticate, requireRole('ADMIN'), rewardController.updateTask);
adminRewardRouter.get('/claims', authenticate, requireRole('ADMIN'), rewardController.listClaims);
