import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { realtimeService } from '../realtime.service.js';
import { creditReward } from './rewardCredit.js';
import { getRewardConfig, type DailyBonusConfig } from './rewardConfig.service.js';

/**
 * 🎁 DAILY BONUS — one claim per IST calendar day, streak ladder.
 *
 * Anti-abuse notes that matter:
 *  • the day key comes from the SERVER clock in Asia/Kolkata, never the phone;
 *  • the unique key `(userId, claimDay)` is what actually stops a double claim —
 *    the pre-check below only produces the friendly error;
 *  • a missed day resets the streak to 1 (configurable).
 */

const IST = 'Asia/Kolkata';

/** "2026-11-20" in IST for any Date. */
export function istDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function istYesterdayKey(): string {
  return istDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

export interface DailyBonusState {
  available: boolean;
  claimedToday: boolean;
  amount: number;
  streakDay: number;
  streakTarget: number;
  ladder: number[];
  /** Why it is not claimable, when it is not. */
  blockedReason: 'CLAIMED_TODAY' | 'MIN_MATCHES' | null;
  minMatches: number;
  matchesPlayed: number;
  lastClaimAt: Date | null;
  /** "12h 40m" style hint for "kab milega" — filled by the controller. */
  nextClaimInSeconds: number;
}

/** Streak day the NEXT claim would be for (1 when the streak broke). */
function nextStreakDay(last: { claimDay: string; streakDay: number } | null, cfg: DailyBonusConfig): number {
  if (!last) return 1;
  if (last.claimDay === istYesterdayKey()) {
    return last.streakDay >= cfg.ladder.length ? 1 : last.streakDay + 1;
  }
  return cfg.resetOnMiss ? 1 : Math.min(last.streakDay + 1, cfg.ladder.length);
}

function secondsUntilTomorrowIst(): number {
  const now = new Date();
  const today = istDayKey(now);
  // Walk forward in 15-minute steps until the IST day changes: cheap, DST-free,
  // and good enough for a countdown label.
  for (let minutes = 15; minutes <= 24 * 60; minutes += 15) {
    const probe = new Date(now.getTime() + minutes * 60 * 1000);
    if (istDayKey(probe) !== today) {
      return Math.max(60, Math.round((probe.getTime() - now.getTime()) / 1000));
    }
  }
  return 24 * 60 * 60;
}

export async function getDailyBonusState(
  tenantId: string,
  userId: string,
): Promise<DailyBonusState> {
  const cfg = (await getRewardConfig(tenantId)).dailyBonus;
  const today = istDayKey();

  const [last, matchesPlayed] = await Promise.all([
    prisma.dailyBonusClaim.findFirst({
      where: { userId },
      orderBy: { claimDay: 'desc' },
      select: { claimDay: true, streakDay: true, createdAt: true },
    }),
    prisma.matchResult.count({ where: { userId } }),
  ]);

  const claimedToday = last?.claimDay === today;
  const streakDay = claimedToday ? last!.streakDay : nextStreakDay(last, cfg);
  const meetsMatches = matchesPlayed >= cfg.minMatches;
  const blockedReason = claimedToday
    ? 'CLAIMED_TODAY'
    : meetsMatches
      ? null
      : 'MIN_MATCHES';

  return {
    available: !claimedToday && meetsMatches,
    claimedToday,
    amount: cfg.ladder[Math.min(streakDay, cfg.ladder.length) - 1] ?? 0,
    streakDay,
    streakTarget: cfg.ladder.length,
    ladder: cfg.ladder,
    blockedReason,
    minMatches: cfg.minMatches,
    matchesPlayed,
    lastClaimAt: last?.createdAt ?? null,
    nextClaimInSeconds: claimedToday ? secondsUntilTomorrowIst() : 0,
  };
}

export interface DailyClaimResult extends DailyBonusState {
  credited: number;
  depositBalance: number;
  winningBalance: number;
}

export async function claimDailyBonus(
  tenantId: string,
  userId: string,
): Promise<DailyClaimResult> {
  const cfg = (await getRewardConfig(tenantId)).dailyBonus;
  const today = istDayKey();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isBanned: true },
  });
  if (!user) throw ApiError.notFound('Player not found');
  if (user.isBanned) throw ApiError.forbidden('Account is blocked');

  const [last, matchesPlayed] = await Promise.all([
    prisma.dailyBonusClaim.findFirst({
      where: { userId },
      orderBy: { claimDay: 'desc' },
      select: { claimDay: true, streakDay: true, createdAt: true },
    }),
    prisma.matchResult.count({ where: { userId } }),
  ]);

  if (last?.claimDay === today) {
    throw ApiError.conflict('Aaj ka bonus already claim ho chuka hai');
  }
  if (matchesPlayed < cfg.minMatches) {
    throw ApiError.forbidden(
      `Daily bonus ke liye ${cfg.minMatches} match khelna zaroori hai (abhi ${matchesPlayed})`,
    );
  }

  const streakDay = nextStreakDay(last, cfg);
  const amount = cfg.ladder[Math.min(streakDay, cfg.ladder.length) - 1] ?? 0;

  const { credited, depositBalance, winningBalance } = await prisma.$transaction(
    async (tx) => {
      // The unique key is the real guard: two taps cannot both insert.
      let claim;
      try {
        claim = await tx.dailyBonusClaim.create({
          data: { tenantId, userId, claimDay: today, streakDay, amount },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw ApiError.conflict('Aaj ka bonus already claim ho chuka hai');
        }
        throw err;
      }

      const credit = await creditReward(tx, {
        tenantId,
        userId,
        amount,
        category: 'DAILY_BONUS',
        referenceId: claim.id,
        notes: `Daily bonus — day ${streakDay} of ${cfg.ladder.length}`,
      });
      return { credited: credit.amount, depositBalance: credit.depositBalance, winningBalance: credit.winningBalance };
    },
    { isolationLevel: 'Serializable' as never },
  );

  // Balance push is best-effort: the money is already committed.
  pushWallet(userId, depositBalance, winningBalance, 'DAILY_BONUS', credited);

  const state = await getDailyBonusState(tenantId, userId);
  return { ...state, credited, depositBalance, winningBalance };
}

export function pushWallet(
  userId: string,
  depositBalance: number,
  winningBalance: number,
  event: string,
  amount?: number,
): void {
  try {
    realtimeService.sendToUser(userId, 'WALLET_UPDATED', {
      userId,
      depositBalance: depositBalance.toFixed(2),
      winningBalance: winningBalance.toFixed(2),
      totalBalance: (depositBalance + winningBalance).toFixed(2),
      source: event,
      amount: amount ?? 0,
    });
  } catch (error) {
    console.warn('[Reward wallet nudge failed]', error);
  }
}

export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'P2002';
}
