/**
 * Manage Matches — the admin control room.
 *
 * One service behind the single screen that takes a match from "open for
 * joins" to "money paid": browse matches, watch who joined, publish the room,
 * go live, score kills, mark players done, ban/refund a seat, cancel, pay out.
 *
 * Money rules live here, not in the UI:
 *  - kills are capped at seats - 1 (the same ceiling the payout guard uses),
 *  - a banned seat never contributes a rupee,
 *  - a seat cannot be refunded once the scoreboard has credited it a kill,
 *  - every refund writes a WalletLedger row and re-derives the pool.
 */
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser } from '../types/auth.js';
import { realtimeService } from './realtime.service.js';
import { computePrizePool } from './tournament.service.js';

/** Matches a control room cares about, in the order the tabs show them. */
const LIVE_STATUSES = ['LIVE', 'SLOTS_FULL'] as const;
const UPCOMING_STATUSES = ['OPEN', 'UPCOMING', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;
const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED'] as const;

export type ManageFilter = 'live' | 'upcoming' | 'all' | 'closed';

export interface ManageMatchRow {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  status: string;
  entryFee: number;
  perKillPrize: number;
  prizePool: number;
  totalSlots: number;
  joined: number;
  banned: number;
  totalKills: number;
  finished: number;
  matchTime: string;
  roomId: string | null;
  roomPassword: string | null;
  roomPublished: boolean;
}

export interface ManageBoardRow {
  userId: string;
  slotNumber: number;
  ign: string;
  freeFireUid: string;
  phoneNumber: string | null;
  kills: number;
  isEliminated: boolean;
  isBanned: boolean;
  banReason: string | null;
  joinedAt: string;
  paid: number;
}

export interface ManageBoard {
  match: ManageMatchRow;
  players: ManageBoardRow[];
  aliveCount: number;
  totalKills: number;
  /** Kills the lobby could possibly reach: seats - 1. */
  maxKills: number;
  /** What the current scoreboard would pay at the per-kill rate. */
  payoutPreview: number;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function findMatchOrThrow(tenantId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
  });
  if (!tournament) throw ApiError.notFound('Match not found');
  return tournament;
}

function toMatchRow(match: {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  status: string;
  entryFee: Prisma.Decimal;
  perKillPrize: Prisma.Decimal;
  prizePool: Prisma.Decimal;
  totalSlots: number;
  matchTime: Date;
  roomId: string | null;
  roomPassword: string | null;
  roomRevealedAt: Date | null;
  _count?: { slots: number };
}, extra: { banned: number; totalKills: number; finished: number }): ManageMatchRow {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    title: match.title,
    gameMode: match.gameMode,
    matchType: match.matchType,
    mapType: match.mapType,
    status: match.status,
    entryFee: num(match.entryFee),
    perKillPrize: num(match.perKillPrize),
    prizePool: num(match.prizePool),
    totalSlots: match.totalSlots,
    joined: match._count?.slots ?? 0,
    banned: extra.banned,
    totalKills: extra.totalKills,
    finished: extra.finished,
    matchTime: match.matchTime.toISOString(),
    roomId: match.roomId,
    roomPassword: match.roomPassword,
    roomPublished: Boolean(match.roomId && match.roomPassword && match.roomRevealedAt),
  };
}

/**
 * Match rows for the control room. Search runs in SQL so a busy tenant with a
 * hundred matches still answers in one small query — matching a player inside
 * the match counts too (IGN, UID or phone), which is how an admin actually
 * finds "the match where 9876543210 is playing".
 */
export async function listManageMatches(
  tenantId: string,
  filter: ManageFilter,
  search?: string,
): Promise<{ matches: ManageMatchRow[]; counts: Record<ManageFilter, number> }> {
  const where: Prisma.TournamentWhereInput = { tenantId };
  if (filter === 'live') where.status = { in: [...LIVE_STATUSES] };
  else if (filter === 'upcoming') where.status = { in: [...UPCOMING_STATUSES] };
  else if (filter === 'closed') where.status = { in: [...CLOSED_STATUSES] };

  const q = search?.trim();
  if (q) {
    const asNumber = Number(q);
    // matchNumber is int4; a longer digit string (a phone number, a UID) would
    // otherwise blow up the query with P2020 instead of just not matching.
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
    orderBy: [{ matchTime: 'desc' }, { matchNumber: 'desc' }],
    take: 60,
    include: {
      _count: { select: { slots: true } },
      slots: {
        select: { isBanned: true, liveKills: true, isEliminated: true },
      },
    },
  });

  const [liveCount, upcomingCount, closedCount, allCount] = await Promise.all([
    prisma.tournament.count({ where: { tenantId, status: { in: [...LIVE_STATUSES] } } }),
    prisma.tournament.count({ where: { tenantId, status: { in: [...UPCOMING_STATUSES] } } }),
    prisma.tournament.count({ where: { tenantId, status: { in: [...CLOSED_STATUSES] } } }),
    prisma.tournament.count({ where: { tenantId } }),
  ]);

  return {
    matches: matches.map((match) =>
      toMatchRow(match, {
        banned: match.slots.filter((slot) => slot.isBanned).length,
        totalKills: match.slots.reduce((sum, slot) => sum + slot.liveKills, 0),
        finished: match.slots.filter((slot) => slot.isEliminated).length,
      }),
    ),
    counts: { live: liveCount, upcoming: upcomingCount, closed: closedCount, all: allCount },
  };
}

/** Everything the player table and the submit footer need for one match. */
export async function getLiveBoard(tenantId: string, tournamentId: string): Promise<ManageBoard> {
  const match = await findMatchOrThrow(tenantId, tournamentId);

  const slots = await prisma.tournamentSlot.findMany({
    where: { tournamentId },
    orderBy: [{ liveKills: 'desc' }, { slotNumber: 'asc' }],
    include: {
      user: {
        select: {
          phoneNumber: true,
          matchResults: {
            where: { tournamentId },
            select: { prizeWon: true },
            take: 1,
          },
        },
      },
    },
  });

  const players: ManageBoardRow[] = slots.map((slot) => ({
    userId: slot.userId,
    slotNumber: slot.slotNumber,
    ign: slot.inGameNameSnapshot?.trim() || `Slot ${slot.slotNumber}`,
    freeFireUid: slot.inGameUidSnapshot?.trim() || '—',
    phoneNumber: slot.user?.phoneNumber ?? null,
    kills: slot.liveKills,
    isEliminated: slot.isEliminated,
    isBanned: slot.isBanned,
    banReason: slot.banReason,
    joinedAt: slot.joinedAt.toISOString(),
    paid: num(slot.user?.matchResults?.[0]?.prizeWon),
  }));

  const payable = players.filter((player) => !player.isBanned);
  const totalKills = payable.reduce((sum, player) => sum + player.kills, 0);

  return {
    match: toMatchRow(match, {
      banned: players.filter((player) => player.isBanned).length,
      totalKills: players.reduce((sum, player) => sum + player.kills, 0),
      finished: players.filter((player) => player.isEliminated).length,
    }),
    players,
    aliveCount: players.filter((player) => !player.isEliminated && !player.isBanned).length,
    totalKills,
    // The ceiling is how many players the lobby can hold, not how many have
    // joined yet: scoring starts as soon as the first player is in the room.
    maxKills: Math.max(0, match.totalSlots - 1),
    payoutPreview: round2(totalKills * num(match.perKillPrize)),
  };
}

function announceBoard(tenantId: string, tournamentId: string, payload: Record<string, unknown>): void {
  try {
    realtimeService.broadcastToTenant(tenantId, 'LIVE_BOARD_UPDATED', {
      tournamentId,
      ...payload,
    });
  } catch (error) {
    console.warn('[Live board broadcast failed]', error);
  }
}

async function findSlotOrThrow(tournamentId: string, userId: string) {
  const slot = await prisma.tournamentSlot.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true, liveKills: true, isEliminated: true, isBanned: true, slotNumber: true },
  });
  if (!slot) throw ApiError.notFound('This player is not in this match');
  return slot;
}

/**
 * Sets a player's kill count to an absolute value. Absolute (not +/-) keeps two
 * admins clicking at once from drifting: the last write is the truth, and the
 * broadcast tells the other screen what that truth is.
 */
export async function setPlayerKills(
  staff: AuthUser,
  tournamentId: string,
  userId: string,
  kills: number,
): Promise<ManageBoard> {
  const match = await findMatchOrThrow(staff.tenantId, tournamentId);
  const slot = await findSlotOrThrow(tournamentId, userId);

  if (slot.isBanned) throw ApiError.conflict('This player is banned — unban before scoring');
  if (slot.isEliminated) throw ApiError.conflict('This player is already marked done');

  const seats = match.totalSlots;
  const maxKills = Math.max(0, seats - 1);
  if (!Number.isInteger(kills) || kills < 0 || kills > maxKills) {
    throw ApiError.badRequest(
      `Kills must be a whole number between 0 and ${maxKills} for this ${seats}-player match`,
    );
  }

  await prisma.tournamentSlot.update({ where: { id: slot.id }, data: { liveKills: kills } });
  announceBoard(staff.tenantId, tournamentId, { userId, kills, isEliminated: slot.isEliminated });

  return getLiveBoard(staff.tenantId, tournamentId);
}

/** Marks a player finished (dead). Frozen kills, sinks to the bottom of the table. */
export async function setPlayerDone(
  staff: AuthUser,
  tournamentId: string,
  userId: string,
  done: boolean,
): Promise<ManageBoard> {
  const match = await findMatchOrThrow(staff.tenantId, tournamentId);
  const slot = await findSlotOrThrow(tournamentId, userId);

  if (!(match.status === 'LIVE' || match.status === 'SLOTS_FULL')) {
    throw ApiError.conflict('Kills can only be marked while the match is live');
  }
  if (slot.isBanned) throw ApiError.conflict('This player is banned — nothing to finish');

  await prisma.tournamentSlot.update({
    where: { id: slot.id },
    data: { isEliminated: done, eliminatedAt: done ? new Date() : null },
  });
  announceBoard(staff.tenantId, tournamentId, {
    userId,
    kills: slot.liveKills,
    isEliminated: done,
  });

  return getLiveBoard(staff.tenantId, tournamentId);
}

/**
 * Refunds one seat: back to the balance the fee came from, removes the seat,
 * shrinks the pool. Refused once that seat has kills on the board, because the
 * money is already spoken for.
 */
export async function refundParticipant(
  staff: AuthUser,
  tournamentId: string,
  userId: string,
  reason?: string,
): Promise<{ board: ManageBoard; refunded: number }> {
  const match = await findMatchOrThrow(staff.tenantId, tournamentId);
  const slot = await findSlotOrThrow(tournamentId, userId);

  if (CLOSED_STATUSES.includes(match.status as (typeof CLOSED_STATUSES)[number])) {
    throw ApiError.conflict(`This match is ${match.status} — refunds are closed`);
  }
  if (slot.liveKills > 0) {
    throw ApiError.conflict(
      'This player already has kills on the board — reset the kills to 0 before refunding',
    );
  }

  const entryFee = num(match.entryFee);
  const note = reason?.trim() || 'Seat refunded by admin';
  const tenant = await prisma.tenant.findUnique({
    where: { id: staff.tenantId },
    select: { commissionRate: true },
  });
  const commission = num(tenant?.commissionRate);

  await prisma.$transaction(
    async (tx) => {
      // Same balance the join debited, so the ledger stays an honest story.
      const joinLedger = await tx.walletLedger.findFirst({
        where: { userId, referenceId: tournamentId, category: 'JOIN_FEE' },
        orderBy: { createdAt: 'asc' },
      });
      const balanceType: 'DEPOSIT' | 'WINNING' = joinLedger?.balanceType ?? 'DEPOSIT';

      const updatedUser =
        balanceType === 'DEPOSIT'
          ? await tx.user.update({
              where: { id: userId },
              data: { depositBalance: { increment: entryFee } },
            })
          : await tx.user.update({
              where: { id: userId },
              data: { winningBalance: { increment: entryFee } },
            });

      await tx.walletLedger.create({
        data: {
          tenantId: staff.tenantId,
          userId,
          amount: entryFee,
          balanceType,
          type: 'CREDIT',
          category: 'REFUND',
          balanceAfter: balanceType === 'DEPOSIT' ? updatedUser.depositBalance : updatedUser.winningBalance,
          referenceId: tournamentId,
          notes: note,
        },
      });

      await tx.tournamentSlot.delete({ where: { id: slot.id } });

      // The pool is only ever the money actually collected, minus the cut.
      const remaining = await tx.tournamentSlot.count({ where: { tournamentId } });
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          prizePool: computePrizePool(
            entryFee,
            remaining,
            num(match.perKillPrize),
            commission,
          ),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 20000 },
  );

  announceBoard(staff.tenantId, tournamentId, { userId, refunded: true });
  return { board: await getLiveBoard(staff.tenantId, tournamentId), refunded: entryFee };
}