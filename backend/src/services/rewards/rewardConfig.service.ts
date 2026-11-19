import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * 🎛️ REWARD CONFIG + FEATURE FLAGS (per tenant)
 *
 * Two JSON blobs on `Tenant`, validated here so a typo can never reach the
 * ledger:
 *   featureFlags → which reward modules the server allows right now
 *   rewardConfig → the numbers (daily ladder, referral amounts, tasks)
 *
 * Defaults below are the ones proposed in plan/rewards/02-backend.md §4. The
 * admin console PATCHes a partial object; everything absent falls back here.
 */

export interface DailyBonusConfig {
  ladder: number[];
  resetOnMiss: boolean;
  minMatches: number;
}

export interface ReferralConfig {
  rewardPerFriend: number;
  friendReward: number;
  minMatches: number;
  maxPerDay: number;
  withdrawable: boolean;
}

export interface RewardConfig {
  dailyBonus: DailyBonusConfig;
  referral: ReferralConfig;
}

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  dailyBonus: {
    ladder: [2, 3, 5, 5, 8, 10, 20],
    resetOnMiss: true,
    minMatches: 0,
  },
  referral: {
    rewardPerFriend: 40,
    friendReward: 20,
    minMatches: 1,
    maxPerDay: 10,
    withdrawable: false,
  },
};

const dailyBonusSchema = z.object({
  ladder: z.array(z.number().int().min(0).max(1000)).min(1).max(14).optional(),
  resetOnMiss: z.boolean().optional(),
  minMatches: z.number().int().min(0).max(50).optional(),
});

const referralSchema = z.object({
  rewardPerFriend: z.number().min(0).max(10000).optional(),
  friendReward: z.number().min(0).max(10000).optional(),
  minMatches: z.number().int().min(0).max(50).optional(),
  maxPerDay: z.number().int().min(0).max(100).optional(),
  withdrawable: z.boolean().optional(),
});

export const rewardConfigSchema = z.object({
  dailyBonus: dailyBonusSchema.optional(),
  referral: referralSchema.optional(),
});

export const featureFlagsSchema = z.object({
  referral: z.boolean().optional(),
  daily_bonus: z.boolean().optional(),
  tasks: z.boolean().optional(),
  earn_hub: z.boolean().optional(),
  rewards_push: z.boolean().optional(),
});

export type FeatureFlagKey = keyof z.infer<typeof featureFlagsSchema>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Deep-merge a tenant's stored config over the defaults (never returns partial). */
export function mergeRewardConfig(stored: unknown): RewardConfig {
  const raw = asRecord(stored);
  const daily = asRecord(raw.dailyBonus);
  const referral = asRecord(raw.referral);

  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const ladder = Array.isArray(daily.ladder)
    ? daily.ladder.filter((n): n is number => typeof n === 'number' && n >= 0)
    : [];

  return {
    dailyBonus: {
      ladder: ladder.length ? ladder : DEFAULT_REWARD_CONFIG.dailyBonus.ladder,
      resetOnMiss: bool(daily.resetOnMiss, DEFAULT_REWARD_CONFIG.dailyBonus.resetOnMiss),
      minMatches: Math.max(0, Math.trunc(num(daily.minMatches, DEFAULT_REWARD_CONFIG.dailyBonus.minMatches))),
    },
    referral: {
      rewardPerFriend: Math.max(0, num(referral.rewardPerFriend, DEFAULT_REWARD_CONFIG.referral.rewardPerFriend)),
      friendReward: Math.max(0, num(referral.friendReward, DEFAULT_REWARD_CONFIG.referral.friendReward)),
      minMatches: Math.max(0, Math.trunc(num(referral.minMatches, DEFAULT_REWARD_CONFIG.referral.minMatches))),
      maxPerDay: Math.max(0, Math.trunc(num(referral.maxPerDay, DEFAULT_REWARD_CONFIG.referral.maxPerDay))),
      // Never let a stored value turn bonus money into withdrawable cash by accident.
      withdrawable: bool(referral.withdrawable, DEFAULT_REWARD_CONFIG.referral.withdrawable),
    },
  };
}

export async function getRewardConfig(tenantId: string): Promise<RewardConfig> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { rewardConfig: true },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  return mergeRewardConfig(tenant.rewardConfig);
}

/** Owner console: partial patch, merged over what is already stored. */
export async function updateRewardConfig(
  tenantId: string,
  patch: z.infer<typeof rewardConfigSchema>,
): Promise<RewardConfig> {
  const current = await getRewardConfig(tenantId);
  const next: RewardConfig = {
    dailyBonus: { ...current.dailyBonus, ...(patch.dailyBonus ?? {}) },
    referral: { ...current.referral, ...(patch.referral ?? {}) },
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { rewardConfig: next as unknown as object },
  });
  return next;
}

// ─── FEATURE FLAGS ──────────────────────────────────────────────────────

/**
 * Server-side kill switch. An absent key means "no opinion" — the APK's
 * build-time flag decides. Only an explicit `false` hides a module, and the
 * server can never turn on something the APK was not built with.
 */
export async function getFeatureFlags(tenantId: string): Promise<Record<string, boolean>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  const raw = asRecord(tenant.featureFlags);
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export async function updateFeatureFlags(
  tenantId: string,
  patch: z.infer<typeof featureFlagsSchema>,
): Promise<Record<string, boolean>> {
  const current = await getFeatureFlags(tenantId);
  const next = { ...current, ...patch };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { featureFlags: next as unknown as object },
  });
  return next;
}

/**
 * Route guard: 404 (not 403) when a module is switched off, so a stale APK
 * behaves exactly like an APK that never had the feature.
 */
export function assertModuleEnabled(
  flags: Record<string, boolean>,
  key: FeatureFlagKey,
  label: string,
): void {
  if (flags[key] === false) throw ApiError.notFound(`${label} is not available`);
}
