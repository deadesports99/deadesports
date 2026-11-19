import { Prisma } from '../generated/prisma/client.js';
import type { TournamentStatus } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { qualifyReferralForPlayer } from './rewards/referral.service.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser } from '../types/auth.js';
import { clearTournamentRedis } from './slotLock.service.js';
import { pushToTournamentParticipants } from './fcm.service.js';
import { realtimeService } from './realtime.service.js';
import {
  DEFAULT_ROOM_REVEAL_MINUTES,
  MINUTE_MS,
  isRoomUnlocked,
  resolveRoomRevealMinutes,
  roomRevealMeta,
  secondsUntilRoomReveal,
} from './roomReveal.js';

// ─── Constants ───────────────────────────────────────────────────────────

/**
 * Legacy constant kept for backwards compatibility: the DEFAULT reveal window
 * is 15 minutes (admins can override per match via `roomRevealMinutes`).
 */
export const ROOM_REVEAL_WINDOW_MS = DEFAULT_ROOM_REVEAL_MINUTES * MINUTE_MS;

/**
 * Per-kill only: this platform runs kill-bounty matches, so there is no
 * placement (1st/2nd/3rd) prize. Empty on purpose — keep it so the wider
 * payout code still compiles if a placement format is ever reintroduced.
 */
const RANK_PRIZE_SHARE: Record<number, number> = {};

/** Statuses from which a payout may be executed by Spectator / Staff. */
const PAYOUTABLE_STATUSES = ['ROOM_REVEALED', 'STARTING_SOON', 'LIVE', 'UNDER_REVIEW', 'OPEN', 'SLOTS_FULL'] as const;

/** Statuses from which the admin may "End Match & Pay Winner by UID". */
const FINISHABLE_STATUSES = ['OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'STARTING_SOON', 'LIVE', 'UNDER_REVIEW'] as const;

const isStaff = (user: AuthUser): boolean => user.role === 'ADMIN' || user.role === 'SUB_ADMIN';

/**
 * Room credentials are staff-visible BEFORE the reveal only for the sections
 * that actually own the room: publish / manage / money. A "Final payout (view)"
 * or wallet-only staff key must not be able to read the password, and a staff
 * member with no relevant flag is treated exactly like a player (must hold a
 * seat AND the room must be revealed).
 */
const mayWorkRoom = (user: AuthUser): boolean => {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'SUB_ADMIN') return false;
  return Boolean(user.canUpdateRoomId || user.canManageMatch || user.canDistributePrize);
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ─── 1. TIMED ROOM CREDENTIALS ──────────────────────────────────────────

/**
 * Admin/Staff publishes the custom room ID + password.
 *
 * Visibility is admin-controlled:
 *  - `revealNow = true`             -> visible to players immediately
 *  - `now >= matchTime - N minutes`  -> visible automatically (N = roomRevealMinutes)
 *  - otherwise                       -> stored, hidden until the reveal window opens
 */
export async function updateRoomCredentials(
  staffUser: AuthUser,
  tournamentId: string,
  roomId: string,
  roomPassword: string,
  revealNow: boolean = false,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staffUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  /**
   * The room code is final once the match is running: players are already in the
   * lobby, so a late edit would send half the room to the wrong place. Only the
   * pre-kickoff window (UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED /
   * STARTING_SOON / DRAFT) may publish or correct credentials.
   */
  const ROOM_LOCKED = ['LIVE', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'] as const;
  if (ROOM_LOCKED.includes(tournament.status as (typeof ROOM_LOCKED)[number])) {
    throw ApiError.conflict(
      tournament.status === 'LIVE' || tournament.status === 'UNDER_REVIEW'
        ? 'This match is LIVE — the Room ID & Password are locked. They cannot be changed now.'
        : `Cannot update the room for a ${tournament.status.toLowerCase()} match`,
    );
  }

  // Publishing IS the reveal: the owner wants players to receive the custom room
  // only when staff publish it, never on a clock. `revealNow` is kept as a no-op
  // in the signature so older clients keep working.
  void revealNow;
  const now = Date.now();
  const wasRevealed = Boolean(tournament.roomRevealedAt);

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      roomId: roomId.trim(),
      roomPassword: roomPassword.trim(),
      roomRevealedAt: tournament.roomRevealedAt ?? new Date(),
      status: statusAfterRoomPublish(tournament.status),
    },
  });

  // Editing an already published room updates the players silently.
  await announceRoomReveal(staffUser.tenantId, updated, !wasRevealed);

  // Guard rail: a published room with no seated players means nobody can ever
  // enter (the room code is only shown to confirmed players). The publish still
  // succeeds — the admin is told loudly instead of being blocked.
  const seatedPlayers = await prisma.tournamentSlot.count({ where: { tournamentId } });

  return {
    ...roomRevealMeta(updated, now),
    id: updated.id,
    title: updated.title,
    status: updated.status,
    roomRevealedAt: updated.roomRevealedAt,
    room: { roomId: updated.roomId, roomPassword: updated.roomPassword },
    seatedPlayers,
    warning:
      seatedPlayers === 0
        ? 'No player has joined this match yet — the Room ID is only shown to joined players. ' +
          'Share the room in your WhatsApp/Telegram group, or cancel and re-post the match.'
        : null,
  };
}

/**
 * Publishing a room must never rewind the lifecycle.
 *
 * Rooms are most needed exactly when kickoff has already passed, so a match in
 * STARTING_SOON (or already LIVE / UNDER_REVIEW) keeps its status — otherwise
 * the sweep would have to push it forward again and the player app would blink
 * between "starting soon" and "room out". Everything pre-kickoff becomes
 * ROOM_REVEALED as before.
 */
function statusAfterRoomPublish(current: string): TournamentStatus {
  return current === 'STARTING_SOON' || current === 'LIVE' || current === 'UNDER_REVIEW'
    ? (current as TournamentStatus)
    : ('ROOM_REVEALED' as TournamentStatus);
}

/** Realtime broadcast + private credentials delivery + optional FCM push. */
async function announceRoomReveal(
  tenantId: string,
  tournament: {
    id: string;
    title: string;
    status?: string;
    roomId: string | null;
    roomPassword: string | null;
    roomRevealedAt: Date | null;
  },
  sendPush: boolean,
): Promise<void> {
  realtimeService.broadcastToTenant(tenantId, 'MATCH_STATUS_CHANGED', {
    tournamentId: tournament.id,
    // The live status after publishing — an already-started match stays started.
    status: tournament.status ?? 'ROOM_REVEALED',
    roomRevealedAt: tournament.roomRevealedAt,
  });

  try {
    const confirmedSlots = await prisma.tournamentSlot.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true },
    });
    if (confirmedSlots.length > 0) {
      realtimeService.sendToUsers(
        confirmedSlots.map((s) => s.userId),
        'ROOM_CREDENTIALS_REVEALED',
        {
          tournamentId: tournament.id,
          roomId: tournament.roomId,
          roomPassword: tournament.roomPassword,
          roomRevealedAt: tournament.roomRevealedAt,
        },
      );
    }
  } catch {
    // Realtime delivery is best-effort — the player can always re-fetch.
  }

  if (sendPush) {
    void pushToTournamentParticipants(tournament.id, {
      type: 'ROOM_REVEALED',
      tournamentId: tournament.id,
      title: 'Room ID Released',
      body: `"${tournament.title}" room ID and password are ready. Open the app to view.`,
    });
  }
}

export interface UpdateRoomRevealInput {
  /** New auto-reveal window (minutes before match start). */
  roomRevealMinutes?: number;
  /** Ignore the countdown and show the credentials to players right now. */
  revealNow?: boolean;
}

/**
 * Admin freedom over WHEN players see the Room ID & Password:
 *  - change the auto-reveal window (N minutes before match start), and/or
 *  - press "Reveal Now" to make the published credentials visible immediately.
 */
export async function updateRoomReveal(
  staffUser: AuthUser,
  tournamentId: string,
  input: UpdateRoomRevealInput,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staffUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  // Reveal timing is only meaningful before kick-off; finished/live matches keep
  // their room state so history (and the payout queue) can never be inverted.
  if (
    !(['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'STARTING_SOON'] as readonly string[]).includes(
      tournament.status,
    )
  ) {
    throw ApiError.conflict(
      `Room reveal timing can only be changed before the match starts (status: ${tournament.status})`,
    );
  }

  const hasCredentials = Boolean(tournament.roomId && tournament.roomPassword);
  if (input.revealNow && !hasCredentials) {
    throw ApiError.conflict('Publish the Room ID & Password first, then reveal it to players');
  }

  const now = Date.now();
  // The window value is stored for history only — nothing auto-reveals any more.
  const minutes =
    input.roomRevealMinutes !== undefined
      ? resolveRoomRevealMinutes(input.roomRevealMinutes)
      : tournament.roomRevealMinutes;
  const wasRevealed = Boolean(tournament.roomRevealedAt);
  const shouldReveal = Boolean(input.revealNow) || wasRevealed;

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      roomRevealMinutes: minutes,
      ...(shouldReveal
        ? {
            roomRevealedAt: tournament.roomRevealedAt ?? new Date(),
            status: statusAfterRoomPublish(tournament.status),
          }
        : {}),
    },
  });

  if (shouldReveal) {
    await announceRoomReveal(staffUser.tenantId, updated, !wasRevealed);
  }

  return {
    ...roomRevealMeta(updated, now),
    id: updated.id,
    title: updated.title,
    status: updated.status,
    hasCredentials,
    roomRevealedAt: updated.roomRevealedAt,
    room: { roomId: updated.roomId, roomPassword: updated.roomPassword },
  };
}

export interface RoomAccessResult {
  roomId: string;
  roomPassword: string;
  roomRevealedAt: Date | null;
  matchTime: Date;
  roomRevealMinutes: number;
  /** Always null now: the room appears when staff publish it, not on a clock. */
  roomRevealsAt: string | null;
  roomUnlocked: boolean;
  secondsUntilReveal: number;
}

/**
 * Player access with the admin-only reveal gate.
 * Slot holders (or staff) may read credentials only after staff published them —
 * there is no clock-based unlock.
 */
export async function getRoomCredentials(user: AuthUser, tournamentId: string): Promise<RoomAccessResult> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: user.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!tournament.roomId || !tournament.roomPassword) {
    throw ApiError.conflict('Room credentials have not been set yet');
  }

  // 1) Caller must be a confirmed slot holder OR room-working staff.
  let isSlotHolder = mayWorkRoom(user);
  if (!isSlotHolder) {
    const slot = await prisma.tournamentSlot.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.userId } },
    });
    isSlotHolder = Boolean(slot);
  }
  if (!isSlotHolder) {
    throw ApiError.forbidden('Only confirmed participants can view room credentials');
  }

  const now = Date.now();
  const unlocked = isRoomUnlocked(tournament, now);
  const secondsUntilReveal = secondsUntilRoomReveal(tournament, now);

  // 2) Reveal gate: nothing reaches players (or room-less staff) until published.
  if (!mayWorkRoom(user) && !unlocked) {
    throw ApiError.forbidden(
      'Room ID & Password are not published yet — the organiser will publish them before the match',
      {
        secondsUntilReveal,
        unlockAt: null,
        matchTime: tournament.matchTime.toISOString(),
        roomRevealMinutes: tournament.roomRevealMinutes,
      },
    );
  }

  return {
    roomId: tournament.roomId,
    roomPassword: tournament.roomPassword,
    roomRevealedAt: tournament.roomRevealedAt,
    matchTime: tournament.matchTime,
    roomRevealMinutes: tournament.roomRevealMinutes,
    roomRevealsAt: null,
    roomUnlocked: true,
    secondsUntilReveal,
  };
}

// ─── 4. ADMIN "END MATCH & PAY WINNER BY UID" (one-click finish) ────────

export interface FinishMatchInput {
  /** Winner's Free Fire UID (must belong to a booked participant). */
  winnerUid: string;
  winnerKills?: number;
}

/**
 * The simplest match-completion flow for the admin console:
 *   - admin picks any active match and taps "End Match"
 *   - enters the winner's Free Fire UID (+ kills)
 *   - rank-1 payout (50% pool + kills × per-kill) is credited to that player's
 *     Winning Balance, the official result is stored and the match is COMPLETED.
 */
export async function finishMatchAndPayWinner(
  staffUser: AuthUser,
  tournamentId: string,
  input: FinishMatchInput,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: staffUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (tournament.status === 'COMPLETED') throw ApiError.conflict('This match is already completed');
  if (tournament.status === 'CANCELLED') throw ApiError.conflict('This match was cancelled — nothing to finish');
  if (!(FINISHABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Cannot end a match in status ${tournament.status}`);
  }

  const winnerUid = input.winnerUid.trim();
  if (!/^\d{6,12}$/.test(winnerUid)) {
    throw ApiError.badRequest('Winner UID must be the 6-12 digit Free Fire UID');
  }
  const kills = Math.min(99, Math.max(0, Math.round(Number(input.winnerKills ?? 0))));

  const slot = await prisma.tournamentSlot.findFirst({
    where: { tournamentId, user: { inGameUid: winnerUid } },
    include: { user: true },
  });
  if (!slot) {
    throw ApiError.notFound(
      `No participant in this match has Free Fire UID ${winnerUid}`,
    );
  }

  const perKill = Number(tournament.perKillPrize);
  // Kill bounties can never exceed the cash this match actually collected.
  const paidSeats = await prisma.tournamentSlot.count({ where: { tournamentId } });
  const pool = round2(Number(tournament.entryFee) * paidSeats);
  // Per-kill format: the winner is paid for kills only, never for placement.
  const rankPrize = 0;
  const killPrize = round2(kills * perKill);
  const totalPrize = round2(rankPrize + killPrize);

  // Same ceilings as the bulk payout: one player cannot kill more people than
  // the lobby holds, and kill money cannot exceed the collected pool.
  const seats = await prisma.tournamentSlot.count({ where: { tournamentId } });
  const maxKills = Math.max(0, seats - 1);
  if (kills > maxKills) {
    throw ApiError.badRequest(
      `This match has ${seats} player(s), so at most ${maxKills} kill(s) can be recorded — ${kills} were entered.`,
    );
  }
  if (perKill > 0 && totalPrize > pool + 0.001) {
    throw ApiError.badRequest(
      `${kills} kills x ${perKill} = ${totalPrize} exceeds the ₹${pool} collected from entry fees.`,
    );
  }

  const paid = await prisma.$transaction(
    async (tx) => {
      // Lock the tournament row so two admins cannot double-pay.
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text AS status FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE
      `;
      const current = locked[0];
      if (!current) throw ApiError.notFound('Tournament not found');
      if (current.status === 'COMPLETED') throw ApiError.conflict('This match is already completed');
      if (current.status === 'CANCELLED') throw ApiError.conflict('This match was cancelled');

      if (totalPrize > 0) {
        const creditedUser = await tx.user.update({
          where: { id: slot.userId },
          data: { winningBalance: { increment: totalPrize } },
        });
        await tx.walletLedger.create({
          data: {
            tenantId: staffUser.tenantId,
            userId: slot.userId,
            amount: totalPrize,
            balanceType: 'WINNING',
            type: 'CREDIT',
            category: 'WINNING_PRIZE',
            balanceAfter: creditedUser.winningBalance,
            referenceId: tournamentId,
            notes: `Winner payout — UID ${winnerUid}, rank 1, ${kills} kill(s)`,
          },
        });
      }

      await tx.matchResult.upsert({
        where: { tournamentId_userId: { tournamentId, userId: slot.userId } },
        create: {
          tournamentId,
          userId: slot.userId,
          verifiedKills: kills,
          rank: 1,
          prizeWon: totalPrize,
          isApproved: true,
          isDisqualified: false,
          reviewedAt: new Date(),
        },
        update: {
          verifiedKills: kills,
          rank: 1,
          prizeWon: totalPrize,
          isApproved: true,
          isDisqualified: false,
          disqualifyReason: null,
          reviewedAt: new Date(),
        },
      });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });

      return totalPrize;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 30000,
    },
  );

  await clearTournamentRedis(tournamentId);

  return {
    tournamentId,
    status: 'COMPLETED',
    totalPaid: paid,
    winner: {
      userId: slot.userId,
      playerCode: slot.user.playerCode,
      name: slot.user.name,
      inGameName: slot.user.inGameName,
      inGameUid: slot.user.inGameUid,
      rank: 1,
      kills,
      rankPrize,
      killPrize,
      prize: paid,
    },
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
  /**
   * 1..48, or null when the spectator never ranked this player (died early,
   * quiet match). A null rank pays kills only and gets no rank-prize share.
   */
  rank: number | null;
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
    rank: number | null;
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

  // The budget is the cash this match actually collected, so the kill
  // bounties can never exceed it. Without this guard a spectator mis-typing
  // kills (17 kills in a 5-seat lobby) pays out money the match never held.
  const seats = await prisma.tournamentSlot.count({ where: { tournamentId } });
  const pool = round2(Number(tournament.entryFee) * seats);
  const maxKills = Math.max(0, seats - 1);
  const killsClaimed = results.filter((r) => !r.isDisqualified).reduce((sum, r) => sum + r.verifiedKills, 0);
  if (killsClaimed > maxKills) {
    throw ApiError.badRequest(
      `This match has ${seats} player(s), so at most ${maxKills} kill(s) can be recorded — ${killsClaimed} were entered.`,
    );
  }
  if (perKill > 0 && round2(killsClaimed * perKill) > pool + 0.001) {
    throw ApiError.badRequest(
      `${killsClaimed} kills x ${perKill} = ${round2(killsClaimed * perKill)} exceeds the ₹${pool} collected from entry fees. Lower the kill count or the per-kill rate.`,
    );
  }

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

        const rankPrize = 0;
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
            notes: `Prize: ${entry.verifiedKills} kills x ${perKill} = ${killPrize}`,
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

  // 6) Referral qualification: paying out a match is the moment a friend becomes
  //    a "real" player, so any PENDING invitation tied to these players can now
  //    be promoted and paid. Never fails the payout — it runs after the money
  //    transaction commits, one player at a time.
  for (const entry of summary) {
    try {
      await qualifyReferralForPlayer(staffUser.tenantId, entry.userId, tournamentId);
    } catch (error) {
      console.warn('[Referral qualification failed]', entry.userId, error);
    }
  }

  return {
    tournamentId,
    status: 'COMPLETED',
    totalPaid: round2(summary.reduce((acc, r) => acc + r.totalPrize, 0)),
    playersPaid: summary.length,
    breakdown: summary,
  };
}
