import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser } from '../types/auth.js';
import { clearTournamentRedis } from './slotLock.service.js';
import { pushToTournamentParticipants, pushToUsers } from './fcm.service.js';
import { realtimeService } from './realtime.service.js';

// ─── Constants ───────────────────────────────────────────────────────────

/** Room credentials unlock exactly 15 minutes before matchTime. */
export const ROOM_REVEAL_WINDOW_MS = 15 * 60 * 1000;

/** Rank -> share of prizePool (rank 1 = Booyah). Ranks 4+ earn kill-money only. */
const RANK_PRIZE_SHARE: Record<number, number> = { 1: 0.5, 2: 0.3, 3: 0.2 };

/** Statuses from which a payout may be executed by Spectator / Staff. */
const PAYOUTABLE_STATUSES = ['ROOM_REVEALED', 'LIVE', 'UNDER_REVIEW', 'OPEN', 'SLOTS_FULL'] as const;

const isStaff = (user: AuthUser): boolean => user.role === 'ADMIN' || user.role === 'SUB_ADMIN';

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ─── 1. TIMED ROOM CREDENTIALS ──────────────────────────────────────────

/** Admin/Staff enters the custom room ID + password. Status -> ROOM_REVEALED. */
export async function updateRoomCredentials(
  staffUser: AuthUser,
  tournamentId: string,
  roomId: string,
  roomPassword: string,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staffUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
    throw ApiError.conflict(`Cannot update room for a ${tournament.status} tournament`);
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      roomId: roomId.trim(),
      roomPassword: roomPassword.trim(),
      roomRevealedAt: new Date(),
      status: 'ROOM_REVEALED',
    },
  });

  // Push: alert every confirmed participant that the room is out (T-15 gate).
  
  // Realtime WebSocket broadcast
  realtimeService.broadcastToTenant(staffUser.tenantId, 'MATCH_STATUS_CHANGED', {
    tournamentId,
    status: 'ROOM_REVEALED',
    roomRevealedAt: updated.roomRevealedAt,
  });

  // Privately deliver credentials to confirmed slot participants
  prisma.tournamentSlot.findMany({
    where: { tournamentId },
    select: { userId: true },
  }).then((confirmedSlots) => {
    if (confirmedSlots.length > 0) {
      realtimeService.sendToUsers(
        confirmedSlots.map((s) => s.userId),
        'ROOM_CREDENTIALS_REVEALED',
        {
          tournamentId,
          roomId: updated.roomId,
          roomPassword: updated.roomPassword,
          roomRevealedAt: updated.roomRevealedAt,
        },
      );
    }
  }).catch(() => {});

  void pushToTournamentParticipants(tournamentId, {
    type: 'ROOM_REVEALED',
    tournamentId,
    title: '🏟 Room ID Released!',
    body: `Custom room unlocked for "${updated.title}" — open the app for the code.`,
  });

  return {
    id: updated.id,
    status: updated.status,
    roomRevealedAt: updated.roomRevealedAt,
    room: { roomId: updated.roomId, roomPassword: updated.roomPassword },
  };
}

export interface RoomAccessResult {
  roomId: string;
  roomPassword: string;
  roomRevealedAt: Date | null;
  matchTime: Date;
  secondsUntilReveal: number;
}

/**
 * Player access with the 15-minute countdown lock.
 * Slot holders (or staff) may read credentials from T-15min onwards.
 */
export async function getRoomCredentials(user: AuthUser, tournamentId: string): Promise<RoomAccessResult> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: user.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!tournament.roomId || !tournament.roomPassword) {
    throw ApiError.conflict('Room credentials have not been set yet');
  }

  // 1) Caller must be a confirmed slot holder OR staff.
  let isSlotHolder = isStaff(user);
  if (!isSlotHolder) {
    const slot = await prisma.tournamentSlot.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.userId } },
    });
    isSlotHolder = Boolean(slot);
  }
  if (!isSlotHolder) {
    throw ApiError.forbidden('Only confirmed participants can view room credentials');
  }

  const unlockAt = new Date(tournament.matchTime.getTime() - ROOM_REVEAL_WINDOW_MS);
  const now = Date.now();
  const secondsUntilReveal = Math.max(0, Math.ceil((unlockAt.getTime() - now) / 1000));

  // 2) Timed lock: players cannot see credentials before T-15.
  if (!isStaff(user) && now < unlockAt.getTime()) {
    throw ApiError.forbidden('Room ID will be revealed 15 minutes before match start', {
      secondsUntilReveal,
      unlockAt: unlockAt.toISOString(),
      matchTime: tournament.matchTime.toISOString(),
    });
  }

  return {
    roomId: tournament.roomId,
    roomPassword: tournament.roomPassword,
    roomRevealedAt: tournament.roomRevealedAt,
    matchTime: tournament.matchTime,
    secondsUntilReveal,
  };
}

// ─── 2. OFFICIAL SCOREBOARD (SPECTATOR VERIFIED - NO FAKE SCREENSHOTS) ──

/**
 * Public/Player access: View the official tournament scoreboard & verified winners
 * published directly by the Spectator/Staff.
 */
export async function getTournamentResults(tenantId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      gameMode: true,
      matchType: true,
      mapType: true,
      matchTime: true,
      prizePool: true,
      perKillPrize: true,
    },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  const results = await prisma.matchResult.findMany({
    where: { tournamentId },
    include: {
      user: {
        select: { id: true, inGameName: true, inGameUid: true },
      },
    },
    orderBy: [
      { rank: 'asc' },
      { verifiedKills: 'desc' },
    ],
  });

  return {
    tournament,
    scoreboard: results.map((r) => ({
      rank: r.rank,
      player: r.user,
      kills: r.verifiedKills,
      prizeWon: Number(r.prizeWon),
      isApproved: r.isApproved,
      isDisqualified: r.isDisqualified,
      disqualifyReason: r.disqualifyReason,
    })),
  };
}

// ─── 3. 1-CLICK SPECTATOR VERIFICATION & PAYOUT ─────────────────────────

export interface PayoutResultInput {
  userId: string;
  verifiedKills: number;
  rank: number;
  isDisqualified?: boolean;
  disqualifyReason?: string;
}

export interface PayoutSummary {
  tournamentId: string;
  status: string;
  totalPaid: number;
  playersPaid: number;
  breakdown: Array<{
    userId: string;
    inGameName: string | null;
    verifiedKills: number;
    rank: number;
    rankPrize: number;
    killPrize: number;
    totalPrize: number;
    isDisqualified: boolean;
  }>;
}

/**
 * 1-click payout: Spectator/Staff submits the official match results directly
 * from the game. Calculates (verifiedKills * perKillPrize) + rankPrize and
 * credits wallets atomically.
 */
export async function distributeTournamentPrizes(
  staffUser: AuthUser,
  tournamentId: string,
  results: PayoutResultInput[],
): Promise<PayoutSummary> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staffUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!(PAYOUTABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Payout not allowed while tournament is ${tournament.status}`);
  }
  if (results.length === 0) throw ApiError.badRequest('At least one verified result is required');

  const perKill = Number(tournament.perKillPrize);
  const pool = Number(tournament.prizePool);

  const summary = await prisma.$transaction(
    async (tx) => {
      const breakdown: PayoutSummary['breakdown'] = [];

      for (const entry of results) {
        // Integrity: only confirmed participants can receive prize money.
        const slot = await tx.tournamentSlot.findUnique({
          where: { tournamentId_userId: { tournamentId, userId: entry.userId } },
          include: { user: { select: { id: true, inGameName: true } } },
        });
        if (!slot) {
          throw ApiError.badRequest(`User ${entry.userId} is not a participant of this tournament`);
        }

        // Disqualified players (hackers / teamers) receive zero prize money.
        if (entry.isDisqualified) {
          await tx.matchResult.upsert({
            where: { tournamentId_userId: { tournamentId, userId: entry.userId } },
            create: {
              tournamentId,
              userId: entry.userId,
              verifiedKills: 0,
              rank: null,
              prizeWon: 0,
              isApproved: true,
              isDisqualified: true,
              disqualifyReason: entry.disqualifyReason || 'Disqualified by spectator',
              reviewedAt: new Date(),
            },
            update: {
              verifiedKills: 0,
              rank: null,
              prizeWon: 0,
              isApproved: true,
              isDisqualified: true,
              disqualifyReason: entry.disqualifyReason || 'Disqualified by spectator',
              reviewedAt: new Date(),
            },
          });
          continue;
        }

        // Idempotency guard: an already-approved result is never double-paid.
        const approved = await tx.matchResult.findUnique({
          where: { tournamentId_userId: { tournamentId, userId: entry.userId } },
        });
        if (approved?.isApproved) continue;

        const rankPrize = round2((RANK_PRIZE_SHARE[entry.rank] ?? 0) * pool);
        const killPrize = round2(entry.verifiedKills * perKill);
        const totalPrize = round2(rankPrize + killPrize);

        // 1) Credit the winning balance.
        const creditedUser = await tx.user.update({
          where: { id: entry.userId },
          data: { winningBalance: { increment: totalPrize } },
        });

        // 2) Double-entry ledger: CREDIT / WINNING_PRIZE.
        await tx.walletLedger.create({
          data: {
            tenantId: staffUser.tenantId,
            userId: entry.userId,
            amount: totalPrize,
            balanceType: 'WINNING',
            type: 'CREDIT',
            category: 'WINNING_PRIZE',
            balanceAfter: creditedUser.winningBalance,
            referenceId: tournamentId,
            notes: `Prize: rank ${entry.rank} (${rankPrize}) + ${entry.verifiedKills} kills x ${perKill} (${killPrize})`,
          },
        });

        // 3) Mark the result verified.
        await tx.matchResult.upsert({
          where: { tournamentId_userId: { tournamentId, userId: entry.userId } },
          create: {
            tournamentId,
            userId: entry.userId,
            verifiedKills: entry.verifiedKills,
            rank: entry.rank,
            prizeWon: totalPrize,
            isApproved: true,
            isDisqualified: false,
            reviewedAt: new Date(),
          },
          update: {
            verifiedKills: entry.verifiedKills,
            rank: entry.rank,
            prizeWon: totalPrize,
            isApproved: true,
            isDisqualified: false,
            reviewedAt: new Date(),
          },
        });

        breakdown.push({
          userId: entry.userId,
          inGameName: slot.user.inGameName,
          verifiedKills: entry.verifiedKills,
          rank: entry.rank,
          rankPrize,
          killPrize,
          totalPrize,
          isDisqualified: false,
        });
      }

      // 4) Tournament is marked COMPLETED.
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });

      return breakdown;
    },
    {
      // A 48-player tournament performs ~4 queries per player inside this
      // single ACID payout (~192 queries). On a slow/remote Postgres that
      // exceeds the default 20s interactive timeout, so we give it ample
      // room (2 min). A timeout rolls the WHOLE batch back — no partial
      // payouts — and the spectator simply retaps.
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

  // 5) Wipe Redis seat state — tournament is closed.
  await clearTournamentRedis(tournamentId);

  // Push: alert the winners their prize money was credited.
  void pushToUsers(
    summary.map((r) => r.userId),
    {
      type: 'PRIZE_WON',
      tournamentId,
      title: '💰 Prize Credited!',
      body: `Your winnings from "${tournament.title}" are in your Winning Balance.`,
      data: { totalPaid: String(round2(summary.reduce((acc, r) => acc + r.totalPrize, 0))) },
    },
  );

  return {
    tournamentId,
    status: 'COMPLETED',
    totalPaid: round2(summary.reduce((acc, r) => acc + r.totalPrize, 0)),
    playersPaid: summary.length,
    breakdown: summary,
  };
}
