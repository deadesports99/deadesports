/**
 * FINAL PAYOUT DESK — where a scored match goes after Manage Matches.
 *
 * Flow the owner asked for:
 *   Manage Matches (live scoring: kills, done, bans, refund switch)
 *        └─ "Submit"  ──►  Final Payout (this service)
 *                             └─ "Final payout" + step-up OTP → money out
 *
 * Why a separate step: scoring and paying are different jobs with different
 * risks. Anything already submitted is gone from the live control room, so the
 * admin cannot mix up "match I am scoring" with "match I am paying".
 *
 * The row carries the whole money story of one match:
 *   entry collected → refunds handed back → prizes already paid → still due.
 */
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser } from '../types/auth.js';
import { realtimeService } from './realtime.service.js';

/** Statuses that still make sense to submit for payout (not cancelled/finished). */
const SUBMITTABLE_STATUSES = [
  'OPEN',
  'UPCOMING',
  'SLOTS_FULL',
  'ROOM_REVEALED',
  'STARTING_SOON',
  'LIVE',
  'UNDER_REVIEW',
] as const;

export type PayoutFilter = 'pending' | 'paid' | 'all';

export interface PayoutInboxRow {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  status: string;
  matchTime: string;
  entryFee: number;
  perKillPrize: number;
  totalSlots: number;
  /** Seats sold (banned seats included — they paid too). */
  joined: number;
  banned: number;
  finished: number;
  kills: number;
  /** entryFee x seats — the cash this match brought in. */
  collected: number;
  /** Money handed back (seat refunds + banned-seat refunds, net of reversals). */
  refunded: number;
  /** Prize money already credited by earlier partial payouts. */
  paid: number;
  /** What the current scoreboard still owes (kills x perKill, banned excluded). */
  payoutDue: number;
  payoutSubmittedAt: string;
  /** Room code stays available here so the desk can re-share it with players. */
  roomId: string | null;
  roomPassword: string | null;
  hasRoomCredentials: boolean;
  roomPublished: boolean;
}

export interface PayoutInbox {
  rows: PayoutInboxRow[];
  counts: Record<PayoutFilter, number>;
  totals: {
    collected: number;
    refunded: number;
    paid: number;
    payoutDue: number;
    /** collected - refunded - paid - payoutDue (negative = organiser tops up). */
    balance: number;
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Hand a scored match over to the money desk.
 *
 * Nothing is paid here — this only freezes the hand-off time (and who did it)
 * so the live control room stops showing the match. Re-submitting is safe.
 */
export async function submitMatchForPayout(
  staff: AuthUser,
  tournamentId: string,
): Promise<{ tournamentId: string; payoutSubmittedAt: string; alreadySubmitted: boolean }> {
  const match = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staff.tenantId },
    select: { id: true, status: true, payoutSubmittedAt: true },
  });
  if (!match) throw ApiError.notFound('Match not found');

  if (match.payoutSubmittedAt) {
    return {
      tournamentId: match.id,
      payoutSubmittedAt: match.payoutSubmittedAt.toISOString(),
      alreadySubmitted: true,
    };
  }
  if (match.status === 'CANCELLED') {
    throw ApiError.conflict('This match was cancelled — there is nothing to pay');
  }
  if (match.status === 'COMPLETED') {
    throw ApiError.conflict('This match is already settled and paid');
  }
  if (!(SUBMITTABLE_STATUSES as readonly string[]).includes(match.status)) {
    throw ApiError.conflict(`Cannot submit a ${match.status.toLowerCase()} match for payout`);
  }

  const updated = await prisma.tournament.update({
    where: { id: match.id },
    data: {
      payoutSubmittedAt: new Date(),
      payoutSubmittedBy: staff.userId,
      /**
       * Submitting IS the end of the live phase: scoring is done, so the match
       * must vanish from every LIVE board (admin Live tab, Manage Matches and
       * the player app's LIVE list). Money is not released yet, so it parks in
       * UNDER_REVIEW until the Final Payout desk pays the scoreboard out.
       */
      ...(match.status === 'LIVE' ? { status: 'UNDER_REVIEW' as const } : {}),
    },
    select: { payoutSubmittedAt: true, status: true },
  });

  // The live control room must drop it immediately for every admin screen.
  try {
    realtimeService.broadcastToTenant(staff.tenantId, 'LIVE_BOARD_UPDATED', {
      tournamentId: match.id,
      payoutSubmitted: true,
    });
    // Players still listing it as LIVE must flip to "results pending" now.
    if (updated.status !== match.status) {
      realtimeService.broadcastToTenant(staff.tenantId, 'MATCH_STATUS_CHANGED', {
        tournamentId: match.id,
        status: updated.status,
      });
    }
  } catch {
    /* broadcast is best effort */
  }

  return {
    tournamentId: match.id,
    payoutSubmittedAt: (updated.payoutSubmittedAt ?? new Date()).toISOString(),
    alreadySubmitted: false,
  };
}

/**
 * The money desk list: every submitted match with its full totals.
 * `pending` = still owes money, `paid` = already settled (history).
 */
export async function listPayoutInbox(
  tenantId: string,
  filter: PayoutFilter = 'pending',
  search?: string,
): Promise<PayoutInbox> {
  const baseWhere: Prisma.TournamentWhereInput = { tenantId, payoutSubmittedAt: { not: null } };

  const where: Prisma.TournamentWhereInput = { ...baseWhere };
  if (filter === 'pending') {
    where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
  } else if (filter === 'paid') {
    where.status = 'COMPLETED';
  }

  const q = search?.trim();
  if (q) {
    const asNumber = Number(q);
    const asMatchNumber =
      Number.isInteger(asNumber) && asNumber > 0 && asNumber <= 2_147_483_647 ? asNumber : null;
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      ...(asMatchNumber !== null ? [{ matchNumber: asMatchNumber }] : []),
      {
        slots: {
          some: {
            OR: [
              { inGameNameSnapshot: { contains: q, mode: 'insensitive' } },
              { inGameUidSnapshot: { contains: q } },
              { user: { phoneNumber: { contains: q } } },
            ],
          },
        },
      },
    ];
  }

  const matches = await prisma.tournament.findMany({
    where,
    orderBy: [{ payoutSubmittedAt: 'desc' }],
    take: 80,
    select: {
      id: true,
      matchNumber: true,
      title: true,
      gameMode: true,
      matchType: true,
      mapType: true,
      status: true,
      matchTime: true,
      entryFee: true,
      perKillPrize: true,
      totalSlots: true,
      payoutSubmittedAt: true,
      roomId: true,
      roomPassword: true,
      roomRevealedAt: true,
      slots: { select: { isBanned: true, liveKills: true, isEliminated: true } },
    },
  });

  const ids = matches.map((match) => match.id);

  // Prize money already credited per match.
  const paidRows = ids.length
    ? await prisma.matchResult.groupBy({
        by: ['tournamentId'],
        where: { tournamentId: { in: ids }, isApproved: true },
        _sum: { prizeWon: true },
      })
    : [];
  const paidByMatch = new Map(paidRows.map((row) => [row.tournamentId, num(row._sum.prizeWon)]));

  // Refunds handed back per match (banned-seat refunds net of reversals).
  const refundRows = ids.length
    ? await prisma.walletLedger.groupBy({
        by: ['referenceId', 'type'],
        where: { referenceId: { in: ids }, category: 'REFUND' },
        _sum: { amount: true },
      })
    : [];
  const refundedByMatch = new Map<string, number>();
  for (const row of refundRows) {
    if (!row.referenceId) continue;
    const amount = num(row._sum.amount);
    refundedByMatch.set(
      row.referenceId,
      (refundedByMatch.get(row.referenceId) ?? 0) + (row.type === 'DEBIT' ? -amount : amount),
    );
  }

  const rows: PayoutInboxRow[] = matches.map((match) => {
    const joined = match.slots.length;
    const banned = match.slots.filter((slot) => slot.isBanned).length;
    const finished = match.slots.filter((slot) => slot.isEliminated).length;
    const kills = match.slots
      .filter((slot) => !slot.isBanned)
      .reduce((sum, slot) => sum + slot.liveKills, 0);
    const collected = round2(num(match.entryFee) * joined);
    const paid = round2(paidByMatch.get(match.id) ?? 0);
    const payoutDue = round2(Math.max(0, kills) * num(match.perKillPrize));

    return {
      id: match.id,
      matchNumber: match.matchNumber,
      title: match.title,
      gameMode: match.gameMode,
      matchType: match.matchType,
      mapType: match.mapType,
      status: match.status,
      matchTime: match.matchTime.toISOString(),
      entryFee: num(match.entryFee),
      perKillPrize: num(match.perKillPrize),
      totalSlots: match.totalSlots,
      joined,
      banned,
      finished,
      kills,
      collected,
      refunded: round2(refundedByMatch.get(match.id) ?? 0),
      paid,
      payoutDue,
      payoutSubmittedAt: (match.payoutSubmittedAt ?? new Date()).toISOString(),
      roomId: match.roomId,
      roomPassword: match.roomPassword,
      hasRoomCredentials: Boolean(match.roomId && match.roomPassword),
      roomPublished: Boolean(match.roomId && match.roomPassword && match.roomRevealedAt),
    };
  });

  const sum = (pick: (row: PayoutInboxRow) => number): number =>
    round2(rows.reduce((total, row) => total + pick(row), 0));

  const [pendingCount, paidCount, allCount] = await Promise.all([
    prisma.tournament.count({ where: { ...baseWhere, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.tournament.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
    prisma.tournament.count({ where: baseWhere }),
  ]);

  const collected = sum((row) => row.collected);
  const refunded = sum((row) => row.refunded);
  const paid = sum((row) => row.paid);
  const payoutDue = sum((row) => row.payoutDue);

  return {
    rows,
    counts: { pending: pendingCount, paid: paidCount, all: allCount },
    totals: {
      collected,
      refunded,
      paid,
      payoutDue,
      balance: round2(collected - refunded - paid - payoutDue),
    },
  };
}
