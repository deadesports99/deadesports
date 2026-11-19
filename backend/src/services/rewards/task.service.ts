import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { creditReward } from './rewardCredit.js';
import { isUniqueViolation, istDayKey, pushWallet } from './dailyBonus.service.js';

/**
 * ✅ TASKS — progress is DERIVED from tables we already trust, never stored.
 *
 * JOIN_MATCH     → TournamentSlot rows (a seat that was booked)
 * PLAY_MATCH     → MatchResult rows (a verified match played)
 * TOP10          → MatchResult with rank <= 10
 * FIRST_DEPOSIT  → an APPROVED DepositRequest
 * FIRST_WIN      → MatchResult with prizeWon > 0
 *
 * `TaskClaim` therefore only records what was already paid, which means a
 * missed realtime event can never make progress drift, and re-running progress
 * is free. Claiming is guarded by `@@unique([userId, taskId, periodKey])`.
 */

const DEFAULT_TASKS = [
  {
    code: 'JOIN_1_MATCH',
    title: '1 match join karo',
    description: 'Koi bhi paid match join karke apna pehla task poora karo.',
    kind: 'JOIN_MATCH' as const,
    targetCount: 1,
    rewardAmount: 5,
    sortOrder: 10,
  },
  {
    code: 'PLAY_3_MATCHES',
    title: '3 match khelo',
    description: 'Teen verified matches — kills ya rank se matlab nahi.',
    kind: 'PLAY_MATCH' as const,
    targetCount: 3,
    rewardAmount: 15,
    sortOrder: 20,
  },
  {
    code: 'TOP10_FINISH',
    title: 'Top 10 me aao',
    description: 'Ek match me top 10 rank — booyah nahi, bas top 10.',
    kind: 'TOP10' as const,
    targetCount: 1,
    rewardAmount: 25,
    sortOrder: 30,
  },
  {
    code: 'FIRST_WIN',
    title: 'Pehli jeet',
    description: 'Ek match me prize jeeto — koi bhi amount.',
    kind: 'FIRST_WIN' as const,
    targetCount: 1,
    rewardAmount: 10,
    sortOrder: 40,
  },
  {
    code: 'FIRST_DEPOSIT',
    title: 'Pehli add cash',
    description: 'Wallet me pehli baar paise add karo (admin approve hone ke baad).',
    kind: 'FIRST_DEPOSIT' as const,
    targetCount: 1,
    rewardAmount: 10,
    sortOrder: 50,
  },
];

/** Seeds the default task list once per tenant (idempotent by code). */
export async function ensureDefaultTasks(tenantId: string): Promise<void> {
  const existing = await prisma.taskDefinition.count({ where: { tenantId } });
  if (existing > 0) return;
  await prisma.taskDefinition.createMany({
    data: DEFAULT_TASKS.map((task) => ({ ...task, tenantId })),
    skipDuplicates: true,
  });
}

export interface TaskView {
  id: string;
  code: string;
  title: string;
  description: string | null;
  reward: number;
  progress: number;
  target: number;
  claimable: boolean;
  claimed: boolean;
  repeatable: boolean;
}

/** IST day number — used to bucket repeatable tasks. */
function dayNumber(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
}

function periodKeyFor(cooldownDays: number | null): string {
  if (!cooldownDays || cooldownDays <= 0) return 'once';
  const bucket = Math.floor(dayNumber(istDayKey()) / cooldownDays);
  return `p${bucket}`;
}

async function progressFor(
  kind: string,
  tenantId: string,
  userId: string,
): Promise<number> {
  switch (kind) {
    case 'JOIN_MATCH':
      // TournamentSlot carries no tenantId — scope through its tournament.
      return prisma.tournamentSlot.count({ where: { userId, tournament: { tenantId } } });
    case 'PLAY_MATCH':
      return prisma.matchResult.count({ where: { userId } });
    case 'TOP10':
      return prisma.matchResult.count({ where: { userId, rank: { not: null, lte: 10 } } });
    case 'FIRST_WIN':
      return prisma.matchResult.count({ where: { userId, prizeWon: { gt: 0 } } });
    case 'FIRST_DEPOSIT':
      return prisma.depositRequest.count({ where: { tenantId, userId, status: 'APPROVED' } });
    case 'REFERRAL':
      return prisma.referralEarning.count({ where: { referrerId: userId, status: 'PAID' } });
    default:
      return 0;
  }
}

export async function listTasks(tenantId: string, userId: string): Promise<TaskView[]> {
  await ensureDefaultTasks(tenantId);

  const tasks = await prisma.taskDefinition.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!tasks.length) return [];

  const claims = await prisma.taskClaim.findMany({
    where: { userId, taskId: { in: tasks.map((task) => task.id) } },
  });

  const progressCache = new Map<string, number>();
  const out: TaskView[] = [];

  for (const task of tasks) {
    if (!progressCache.has(task.kind)) {
      progressCache.set(task.kind, await progressFor(task.kind, tenantId, userId));
    }
    const progress = progressCache.get(task.kind) ?? 0;
    const periodKey = periodKeyFor(task.cooldownDays);
    const claim = claims.find((row) => row.taskId === task.id && row.periodKey === periodKey);

    out.push({
      id: task.id,
      code: task.code,
      title: task.title,
      description: task.description,
      reward: Number(task.rewardAmount),
      progress: Math.min(progress, task.targetCount),
      target: task.targetCount,
      claimable: !claim && progress >= task.targetCount,
      claimed: Boolean(claim),
      repeatable: Boolean(task.cooldownDays),
    });
  }
  return out;
}

export interface ClaimResult {
  task: TaskView;
  credited: number;
  depositBalance: number;
  winningBalance: number;
}

export async function claimTask(
  tenantId: string,
  userId: string,
  taskId: string,
): Promise<ClaimResult> {
  const task = await prisma.taskDefinition.findFirst({
    where: { id: taskId, tenantId, isActive: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const progress = await progressFor(task.kind, tenantId, userId);
  if (progress < task.targetCount) {
    throw ApiError.conflict('Task abhi poora nahi hua');
  }

  const periodKey = periodKeyFor(task.cooldownDays);

  const { credited, depositBalance, winningBalance } = await prisma.$transaction(async (tx) => {
    let claim;
    try {
      claim = await tx.taskClaim.create({
        data: {
          tenantId,
          userId,
          taskId,
          periodKey,
          progress,
          amount: task.rewardAmount,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict('Task already claim ho chuka hai');
      throw err;
    }

    const credit = await creditReward(tx, {
      tenantId,
      userId,
      amount: Number(task.rewardAmount),
      category: 'TASK_REWARD',
      referenceId: claim.id,
      notes: `Task reward — ${task.title}`,
    });
    return {
      credited: credit.amount,
      depositBalance: credit.depositBalance,
      winningBalance: credit.winningBalance,
    };
  });

  pushWallet(userId, depositBalance, winningBalance, 'TASK_REWARD', credited);

  const tasks = await listTasks(tenantId, userId);
  const updated = tasks.find((row) => row.id === taskId);
  if (!updated) throw ApiError.conflict('Task state changed — refresh karo');

  return { task: updated, credited, depositBalance, winningBalance };
}

/** Exposed for the admin console (task list without player progress). */
export async function listTaskDefinitions(tenantId: string) {
  await ensureDefaultTasks(tenantId);
  return prisma.taskDefinition.findMany({
    where: { tenantId },
    orderBy: { sortOrder: 'asc' },
  });
}

/** Owner console: edit copy / reward / visibility of one task. */
export async function updateTaskDefinition(
  tenantId: string,
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    rewardAmount?: number;
    targetCount?: number;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  const existing = await prisma.taskDefinition.findFirst({ where: { id: taskId, tenantId } });
  if (!existing) throw ApiError.notFound('Task not found');
  return prisma.taskDefinition.update({ where: { id: taskId }, data: patch });
}

/** Owner console: recent reward payouts across all three modules. */
export async function listRecentClaims(tenantId: string, limit = 100) {
  const [tasks, daily, referrals] = await Promise.all([
    prisma.taskClaim.findMany({ where: { tenantId }, orderBy: { claimedAt: 'desc' }, take: limit }),
    prisma.dailyBonusClaim.findMany({ where: { tenantId }, orderBy: { claimDay: 'desc' }, take: limit }),
    prisma.referralEarning.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit }),
  ]);
  return [
    ...tasks.map((row) => ({
      kind: 'TASK_REWARD' as const,
      userId: row.userId,
      amount: Number(row.amount),
      at: row.claimedAt,
      detail: row.taskId,
    })),
    ...daily.map((row) => ({
      kind: 'DAILY_BONUS' as const,
      userId: row.userId,
      amount: Number(row.amount),
      at: row.createdAt,
      detail: `day ${row.streakDay}`,
    })),
    ...referrals.map((row) => ({
      kind: 'REFERRAL_BONUS' as const,
      userId: row.referrerId,
      amount: Number(row.amount),
      at: row.createdAt,
      detail: `${row.status.toLowerCase()} → ${row.refereeId.slice(0, 8)}`,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
