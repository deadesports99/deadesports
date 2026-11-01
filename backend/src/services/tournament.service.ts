import { randomUUID } from 'node:crypto';
import { Prisma, type TournamentStatus } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthUser } from '../types/auth.js';
import {
  clearTournamentRedis,
  createTeam,
  decrementTeamMembers,
  deleteTeam,
  generateTeamCode,
  getOccupiedSlots,
  hydrateSlotsFromDb,
  joinTeam,
  releaseSlot,
  reserveSlot,
} from './slotLock.service.js';

// ─── Constants ───────────────────────────────────────────────────────────

/** Players per team for each match type (SOLO = 1 seat per team). */
const TEAM_SIZE: Record<'SOLO' | 'DUO' | 'SQUAD', number> = { SOLO: 1, DUO: 2, SQUAD: 4 };

/** Joinable tournament statuses. */
const JOINABLE_STATUSES = ['UPCOMING', 'OPEN'] as const;

/** Tournament statuses from which an admin may cancel + refund. */
const CANCELLABLE_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;

/** Statuses set by the engine that may never be joined. */
const getTeamSize = (matchType: string): number => TEAM_SIZE[matchType as 'SOLO' | 'DUO' | 'SQUAD'] ?? 1;

// ─── Input types ─────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  title: string;
  gameMode: 'BATTLE_ROYALE' | 'CLASH_SQUAD';
  matchType: 'SOLO' | 'DUO' | 'SQUAD';
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  entryFee: number;
  prizePool: number;
  perKillPrize?: number;
  matchTime: Date;
  totalSlots?: number;
}

export interface ListTournamentsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

// ─── Sanitizers ──────────────────────────────────────────────────────────

type TournamentWithMeta = Prisma.TournamentGetPayload<{
  include: { _count: { select: { slots: true } } };
}>;

/** Hide room credentials unless the caller is staff (admin/sub-admin). */
function sanitizeTournament(
  t: TournamentWithMeta,
  visibleCredentials: boolean,
): Record<string, unknown> {
  const { roomId, roomPassword, ...rest } = t;
  return {
    ...rest,
    slotsBooked: t._count.slots,
    room: visibleCredentials ? { roomId, roomPassword } : undefined,
  };
}

// ─── 1. CREATE TOURNAMENT ────────────────────────────────────────────────

export async function createTournament(creator: AuthUser, data: CreateTournamentInput) {
  if (data.matchTime.getTime() <= Date.now()) {
    throw ApiError.badRequest('matchTime must be in the future');
  }
  if (data.entryFee < 0 || data.prizePool < 0 || (data.perKillPrize ?? 0) < 0) {
    throw ApiError.badRequest('entryFee, prizePool and perKillPrize cannot be negative');
  }

  const totalSlots = 48; // SOLO 48 / DUO 24 teams / SQUAD 12 teams — all 48 seats
  if (data.totalSlots !== undefined && data.totalSlots !== totalSlots) {
    throw ApiError.badRequest('Free Fire tournaments use exactly 48 slots');
  }

  const tournament = await prisma.tournament.create({
    data: {
      tenantId: creator.tenantId,
      title: data.title.trim(),
      gameMode: data.gameMode,
      matchType: data.matchType,
      mapType: data.mapType,
      entryFee: data.entryFee,
      prizePool: data.prizePool,
      perKillPrize: data.perKillPrize ?? 0,
      totalSlots,
      matchTime: data.matchTime,
      status: 'OPEN',
    },
    include: { _count: { select: { slots: true } } },
  });

  return sanitizeTournament(tournament, true);
}

// ─── 2. LIST TOURNAMENTS ─────────────────────────────────────────────────

export async function listTournaments(tenantId: string, query: ListTournamentsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 10));

  const where: Prisma.TournamentWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status as TournamentStatus } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.tournament.count({ where }),
    prisma.tournament.findMany({
      where,
      include: { _count: { select: { slots: true } } },
      orderBy: { matchTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: items.map((t) => sanitizeTournament(t, false)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── 3. TOURNAMENT DETAILS ───────────────────────────────────────────────

export async function getTournamentDetails(
  tenantId: string,
  tournamentId: string,
  viewer?: AuthUser,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
    include: { _count: { select: { slots: true } } },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  // Room credentials only for staff; players see them post-reveal (Phase 4).
  const isStaff = viewer && (viewer.role === 'ADMIN' || viewer.role === 'SUB_ADMIN');
  const visibleCredentials = isStaff || tournament.status === 'ROOM_REVEALED' || tournament.status === 'LIVE';

  let mySlot: { slotNumber: number; teamId: string | null } | null = null;
  if (viewer) {
    const slot = await prisma.tournamentSlot.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: viewer.userId },
      },
      select: { slotNumber: true, teamId: true },
    });
    mySlot = slot;
  }

  const liveOccupied = await getOccupiedSlots(tournamentId);
  if (Object.keys(liveOccupied).length === 0 && tournament._count.slots > 0) {
    // Redis cold (TTL/crash) — re-warm from the DB.
    const seats = await prisma.tournamentSlot.findMany({
      where: { tournamentId },
      select: { slotNumber: true, userId: true },
    });
    await hydrateSlotsFromDb(tournamentId, seats);
  }

  return { ...sanitizeTournament(tournament, visibleCredentials), mySlot };
}

// ─── 4. TOURNAMENT SLOTS ─────────────────────────────────────────────────

export async function getTournamentSlots(tenantId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
    select: { id: true, totalSlots: true },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  const slots = await prisma.tournamentSlot.findMany({
    where: { tournamentId },
    include: { user: { select: { id: true, inGameName: true, inGameUid: true, phoneNumber: true } } },
    orderBy: { slotNumber: 'asc' },
  });

  return {
    totalSlots: tournament.totalSlots,
    booked: slots.length,
    slots: slots.map((s) => ({
      slotNumber: s.slotNumber,
      teamId: s.teamId,
      player: s.user,
    })),
  };
}

// ─── 5. JOIN TOURNAMENT (ATOMIC) ─────────────────────────────────────────

export interface JoinTournamentResult {
  slotNumber: number;
  teamId: string | null;
  teamCode?: string; // returned only to the squad leader who created it
  entryFee: number;
  balanceAfter: number;
  tournamentStatus: string;
}

export async function joinTournament(
  user: AuthUser,
  tournamentId: string,
  slotNumber: number,
  teamCode?: string,
): Promise<JoinTournamentResult> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: user.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!(JOINABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Tournament is not accepting entries (status: ${tournament.status})`);
  }
  if (slotNumber < 1 || slotNumber > tournament.totalSlots) {
    throw ApiError.badRequest(`slotNumber must be between 1 and ${tournament.totalSlots}`);
  }

  const teamSize = getTeamSize(tournament.matchType);
  const maxSlots = tournament.totalSlots;

  // ── Squad wiring (DUO / SQUAD) ─────────────────────────────────────
  let teamId: string | undefined;
  let isTeamLeader = false;
  let leaderTeamCode: string | undefined;
  let joinedByCode: string | undefined;

  if (teamSize > 1) {
    if (teamCode) {
      const joined = await joinTeam(tournamentId, teamCode.trim(), teamSize);
      if (!joined.ok) {
        if (joined.code === 'TEAM_FULL') throw ApiError.conflict('Squad is already full');
        throw ApiError.notFound('Invalid squad code');
      }
      teamId = joined.teamId;
      joinedByCode = teamCode.trim();
    } else {
      // Leader flow: generate a unique 6-digit code (retry on collision).
      isTeamLeader = true;
      teamId = randomUUID();
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateTeamCode();
        if (await createTeam(tournamentId, code, teamId, teamSize)) {
          leaderTeamCode = code;
          break;
        }
      }
      if (!leaderTeamCode) {
        throw ApiError.internal('Could not generate a unique squad code, try again');
      }
    }
  }

  // ── Redis atomic seat reservation ──────────────────────────────────
  const reserved = await reserveSlot(tournamentId, slotNumber, user.userId, maxSlots);
  if (!reserved.ok) {
    if (isTeamLeader && leaderTeamCode) {
      await deleteTeam(tournamentId, leaderTeamCode);
    } else if (joinedByCode) {
      await decrementTeamMembers(tournamentId, joinedByCode);
    }
    const message =
      reserved.code === 'SLOT_TAKEN'
        ? `Slot ${slotNumber} is already booked`
        : reserved.code === 'ALREADY_JOINED'
          ? 'You have already joined this tournament'
          : 'Tournament is full';
    throw ApiError.conflict(message);
  }

  const rollbackRedis = async (rawError: unknown): Promise<never> => {
    await releaseSlot(tournamentId, slotNumber, user.userId);
    if (isTeamLeader && leaderTeamCode) {
      // Leader's team never made it into the DB — remove the dangling code.
      await deleteTeam(tournamentId, leaderTeamCode);
    } else if (joinedByCode) {
      await decrementTeamMembers(tournamentId, joinedByCode);
    }
    if (
      rawError instanceof Prisma.PrismaClientKnownRequestError &&
      rawError.code === 'P2002'
    ) {
      throw ApiError.conflict('You have already joined this tournament');
    }
    if (
      rawError instanceof Prisma.PrismaClientKnownRequestError &&
      rawError.code === 'P2034'
    ) {
      throw ApiError.conflict('Booking conflict — please retry');
    }
    throw rawError;
  };

  // ── ACID database transaction ──────────────────────────────────────
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Re-check tournament status inside the transaction (fresh read).
        const liveTournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
        if (!liveTournament || !(JOINABLE_STATUSES as readonly string[]).includes(liveTournament.status)) {
          throw ApiError.conflict(`Tournament is not accepting entries (status: ${liveTournament?.status})`);
        }

        // 1) Conditional atomic balance debit (No lost-update race):
        const depositDebited = await tx.user.updateMany({
          where: { id: user.userId, isBanned: false, depositBalance: { gte: tournament.entryFee } },
          data: { depositBalance: { decrement: tournament.entryFee } },
        });
        let balanceType: 'DEPOSIT' | 'WINNING' = 'DEPOSIT';

        if (depositDebited.count !== 1) {
          // Fall back to the winning balance if the deposit balance is short.
          const winningDebited = await tx.user.updateMany({
            where: { id: user.userId, isBanned: false, winningBalance: { gte: tournament.entryFee } },
            data: { winningBalance: { decrement: tournament.entryFee } },
          });
          if (winningDebited.count !== 1) {
            throw ApiError.badRequest('Insufficient balance to join this tournament');
          }
          balanceType = 'WINNING';
        }

        const freshUser = await tx.user.findUniqueOrThrow({ where: { id: user.userId } });

        // 2) Double-entry ledger: DEBIT / JOIN_FEE.
        await tx.walletLedger.create({
          data: {
            tenantId: user.tenantId,
            userId: user.userId,
            amount: tournament.entryFee,
            balanceType,
            type: 'DEBIT',
            category: 'JOIN_FEE',
            balanceAfter: balanceType === 'DEPOSIT' ? freshUser.depositBalance : freshUser.winningBalance,
            referenceId: tournamentId,
            notes: `Entry fee for "${tournament.title}"`,
          },
        });

        // 3) Seat ticket (unique constraints are the final correctness backstop).
        const slot = await tx.tournamentSlot.create({
          data: {
            tournamentId,
            userId: user.userId,
            slotNumber,
            teamId: teamId ?? null,
          },
        });

        // 4) Flip to SLOTS_FULL the moment the last seat is taken.
        const booked = await tx.tournamentSlot.count({ where: { tournamentId } });
        let status = liveTournament.status;
        if (booked >= maxSlots && status !== 'SLOTS_FULL') {
          await tx.tournament.update({
            where: { id: tournamentId },
            data: { status: 'SLOTS_FULL' },
          });
          status = 'SLOTS_FULL';
        }

        return { slot, freshUser, status };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    return {
      slotNumber: result.slot.slotNumber,
      teamId: result.slot.teamId,
      ...(leaderTeamCode ? { teamCode: leaderTeamCode } : {}),
      entryFee: Number(tournament.entryFee),
      balanceAfter: Number(result.freshUser.depositBalance) + Number(result.freshUser.winningBalance),
      tournamentStatus: result.status,
    };
  } catch (err) {
    // Critical: never leave a Redis seat dangling when the DB says no.
    return await rollbackRedis(err);
  }
}

// ─── 6. CANCEL TOURNAMENT & AUTO-REFUND ALL ──────────────────────────────

export interface CancelResult {
  tournamentId: string;
  status: string;
  refundedPlayers: number;
  totalRefunded: number;
}

export async function cancelTournamentAndRefundAll(
  adminUser: AuthUser,
  tournamentId: string,
  reason: string,
): Promise<CancelResult> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: adminUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Cannot cancel a tournament in status ${tournament.status}`);
  }
  if (!reason?.trim()) throw ApiError.badRequest('A cancellation reason is required');

  const result = await prisma.$transaction(
    async (tx) => {
      // Lock the tournament row so a concurrent join cannot slip through.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE
      `;
      if (locked.length === 0) throw ApiError.notFound('Tournament not found');

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'CANCELLED' },
      });

      const slots = await tx.tournamentSlot.findMany({ where: { tournamentId } });

      let totalRefunded = 0;
      for (const slot of slots) {
        // Refund to the same balance the fee was debited from (audit trail).
        const joinLedger = await tx.walletLedger.findFirst({
          where: { userId: slot.userId, referenceId: tournamentId, category: 'JOIN_FEE' },
          orderBy: { createdAt: 'asc' },
        });
        const balanceType: 'DEPOSIT' | 'WINNING' = joinLedger?.balanceType ?? 'DEPOSIT';

        const refundedUser = balanceType === 'DEPOSIT'
          ? await tx.user.update({
              where: { id: slot.userId },
              data: { depositBalance: { increment: tournament.entryFee } },
            })
          : await tx.user.update({
              where: { id: slot.userId },
              data: { winningBalance: { increment: tournament.entryFee } },
            });

        await tx.walletLedger.create({
          data: {
            tenantId: adminUser.tenantId,
            userId: slot.userId,
            amount: tournament.entryFee,
            balanceType,
            type: 'CREDIT',
            category: 'REFUND',
            balanceAfter: balanceType === 'DEPOSIT' ? refundedUser.depositBalance : refundedUser.winningBalance,
            referenceId: tournamentId,
            notes: `Refund for cancelled tournament: ${reason}`,
          },
        });
        totalRefunded += Number(tournament.entryFee);
      }

      return { refundedPlayers: slots.length, totalRefunded };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 20000,
    },
  );

  // Wipe Redis seat state so the room immediately frees up.
  await clearTournamentRedis(tournamentId);

  return { tournamentId, status: 'CANCELLED', ...result };
}