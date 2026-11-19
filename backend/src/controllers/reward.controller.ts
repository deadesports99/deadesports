import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import * as dailyBonus from '../services/rewards/dailyBonus.service.js';
import * as taskService from '../services/rewards/task.service.js';
import * as referralService from '../services/rewards/referral.service.js';
import {
  assertModuleEnabled,
  featureFlagsSchema,
  getFeatureFlags,
  getRewardConfig,
  rewardConfigSchema,
  updateFeatureFlags,
  updateRewardConfig,
} from '../services/rewards/rewardConfig.service.js';

const applyReferralSchema = z.object({ code: z.string().trim().min(4).max(16) });

function isOn(flags: Record<string, boolean>, key: string): boolean {
  return flags[key] !== false;
}

/**
 * GET /rewards/summary — one round trip for the whole Rewards tab.
 *
 * Every block is optional: a module switched off server-side comes back as
 * `null` (and its endpoints 404), so a stale APK simply renders nothing.
 */
export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const { userId, tenantId } = req.user;

    const flags = await getFeatureFlags(tenantId);
    const dailyEnabled = isOn(flags, 'daily_bonus');
    const tasksEnabled = isOn(flags, 'tasks');
    const referralEnabled = isOn(flags, 'referral');

    const [config, daily, tasks, referral] = await Promise.all([
      getRewardConfig(tenantId),
      dailyEnabled ? dailyBonus.getDailyBonusState(tenantId, userId) : Promise.resolve(null),
      tasksEnabled ? taskService.listTasks(tenantId, userId) : Promise.resolve([]),
      referralEnabled ? referralService.getReferralInfo(tenantId, userId) : Promise.resolve(null),
    ]);

    sendResponse(res, 200, 'Rewards fetched', {
      features: {
        daily_bonus: dailyEnabled,
        tasks: tasksEnabled,
        referral: referralEnabled,
        earn_hub: isOn(flags, 'earn_hub'),
      },
      config: {
        dailyLadder: config.dailyBonus.ladder,
        referralPerFriend: config.referral.rewardPerFriend,
        referralFriendReward: config.referral.friendReward,
        referralMinMatches: config.referral.minMatches,
      },
      dailyBonus: daily,
      tasks,
      referral,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /rewards/daily-bonus/claim */
export async function claimDailyBonus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const flags = await getFeatureFlags(req.user.tenantId);
    assertModuleEnabled(flags, 'daily_bonus', 'Daily bonus');
    const result = await dailyBonus.claimDailyBonus(req.user.tenantId, req.user.userId);
    sendResponse(res, 201, 'Daily bonus claimed', result);
  } catch (err) {
    next(err);
  }
}

/** GET /rewards/tasks */
export async function listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const flags = await getFeatureFlags(req.user.tenantId);
    assertModuleEnabled(flags, 'tasks', 'Tasks');
    const tasks = await taskService.listTasks(req.user.tenantId, req.user.userId);
    sendResponse(res, 200, 'Tasks fetched', { tasks });
  } catch (err) {
    next(err);
  }
}

/** POST /rewards/tasks/:id/claim */
export async function claimTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const flags = await getFeatureFlags(req.user.tenantId);
    assertModuleEnabled(flags, 'tasks', 'Tasks');
    const id = String(req.params.id ?? '');
    if (!id) throw ApiError.badRequest('Task id required');
    const result = await taskService.claimTask(req.user.tenantId, req.user.userId, id);
    sendResponse(res, 201, 'Task reward credited', result);
  } catch (err) {
    next(err);
  }
}

/** GET /rewards/referral */
export async function getReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const flags = await getFeatureFlags(req.user.tenantId);
    assertModuleEnabled(flags, 'referral', 'Referral');
    const info = await referralService.getReferralInfo(req.user.tenantId, req.user.userId);
    sendResponse(res, 200, 'Referral info fetched', info);
  } catch (err) {
    next(err);
  }
}

/** POST /rewards/referral/apply */
export async function applyReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const flags = await getFeatureFlags(req.user.tenantId);
    assertModuleEnabled(flags, 'referral', 'Referral');
    const body = applyReferralSchema.parse(req.body);
    const info = await referralService.applyReferralCode(req.user.tenantId, req.user.userId, body.code);
    sendResponse(res, 200, 'Referral code applied', info);
  } catch (err) {
    next(err);
  }
}

// ─── OWNER CONSOLE ───────────────────────────────────────────────────────

/** GET /admin/rewards/settings — flags + numbers + task list in one payload. */
export async function getAdminSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const tenantId = req.user.tenantId;
    const [flags, config, tasks] = await Promise.all([
      getFeatureFlags(tenantId),
      getRewardConfig(tenantId),
      taskService.listTaskDefinitions(tenantId),
    ]);
    sendResponse(res, 200, 'Reward settings fetched', { features: flags, config, tasks });
  } catch (err) {
    next(err);
  }
}

const adminSettingsSchema = z
  .object({
    features: featureFlagsSchema.optional(),
    config: rewardConfigSchema.optional(),
  })
  .strict();

/** PATCH /admin/rewards/settings */
export async function updateAdminSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const tenantId = req.user.tenantId;
    const body = adminSettingsSchema.parse(req.body);
    if (!body.features && !body.config) throw ApiError.badRequest('Nothing to update');

    const [flags, config] = await Promise.all([
      body.features ? updateFeatureFlags(tenantId, body.features) : getFeatureFlags(tenantId),
      body.config ? updateRewardConfig(tenantId, body.config) : getRewardConfig(tenantId),
    ]);
    sendResponse(res, 200, 'Reward settings saved', { features: flags, config });
  } catch (err) {
    next(err);
  }
}

const taskSchema = z
  .object({
    title: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    rewardAmount: z.number().min(0).max(10000).optional(),
    targetCount: z.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict();

/** PATCH /admin/rewards/tasks/:id — edit copy, reward or visibility. */
export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const patch = taskSchema.parse(req.body);
    const task = await taskService.updateTaskDefinition(req.user.tenantId, String(req.params.id ?? ''), patch);
    sendResponse(res, 200, 'Task updated', task);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/rewards/claims — last N payouts for the audit view. */
export async function listClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authenticated user missing');
    const claims = await taskService.listRecentClaims(req.user.tenantId, 100);
    sendResponse(res, 200, 'Recent reward claims', { claims });
  } catch (err) {
    next(err);
  }
}
