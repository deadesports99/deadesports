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
import { pushToTournamentParticipants } from './fcm.service.js';
import { realtimeService } from './realtime.service.js';
import {
  isRoomUnlocked,
  resolveRoomRevealMinutes,
  roomRevealMeta,
} from './roomReveal.js';
import { autoMatchTitle, nextMatchNumber } from './identity.service.js';

// ─── Constants ───────────────────────────────────────────────────────────

/** Players per team for each match type (SOLO = 1 seat per team). */
const TEAM_SIZE: Record<'SOLO' | 'DUO' | 'SQUAD', number> = { SOLO: 1, DUO: 2, SQUAD: 4 };

/** Joinable tournament statuses. */
const JOINABLE_STATUSES = ['UPCOMING', 'OPEN'] as const;

/** Tournament statuses from which an admin may cancel + refund. */
const CANCELLABLE_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;

/** Statuses whose visibility window can no longer be edited. */
const VISIBILITY_EDITABLE_STATUSES = [
  'DRAFT',
  'UPCOMING',
  'OPEN',
  'SLOTS_FULL',
  'ROOM_REVEALED',
] as const;

/** Player-list visibility window bounds (hours before match start). */
const MIN_VISIBILITY_HOURS = 1;
const MAX_VISIBILITY_HOURS = 336; // 14 days
const HOUR_MS = 60 * 60 * 1000;

/** Statuses set by the engine that may never be joined. */
const getTeamSize = (matchType: string): number => TEAM_SIZE[matchType as 'SOLO' | 'DUO' | 'SQUAD'] ?? 1;

/**
 * Matches that are still relevant for "Publish Room ID": upcoming / open /
 * rooms already out. Old LIVE or COMPLETED matches from previous days are not
 * publishable and must never clutter the admin's publish picker.
 */
const PUBLISHABLE_STATUSES = ['UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;

/** Small grace so a match that just kicked off can still get its room published. */
const PUBLISH_GRACE_MS = 60 * 60 * 1000;

/**
 * Player feed freshness window: a match disappears from the player app this
 * long after kickoff (the admin app keeps the full history forever).
 */
const PLAYER_FEED_GRACE_MS = 3 * 60 * 60 * 1000;

// ─── Input types ─────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  /** Optional — by default the backend generates "<Map> <Type> #N". */
  title?: string;
  gameMode: 'BATTLE_ROYALE' | 'CLASH_SQUAD';
  matchType: 'SOLO' | 'DUO' | 'SQUAD';
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  entryFee: number;
  prizePool: number;
  perKillPrize?: number;
  matchTime: Date;
  totalSlots?: number;
  /** null = list immediately; N = hide from players until N hours before start. */
  visibilityHours?: number | null;
  /** Admin-chosen auto-reveal for Room ID & Password (minutes before start). */
  roomRevealMinutes?: number;
}

export interface ListTournamentsQuery {
  status?: string;
  page?: number;
  limit?: number;
  /**
   * Admin "Publish Room ID" picker: only still-relevant matches
   * (UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED and not long past kickoff).
   */
  publishable?: boolean;
}

// ─── Sanitizers ──────────────────────────────────────────────────────────

type TournamentWithMeta = Prisma.TournamentGetPayload<{
  include: { _count: { select: { slots: true } } };
}>;

/**
 * Turn the admin's "show in list N hours before start" choice into the stored
 * window. null/undefined = list immediately; otherwise visibleFrom is
 * matchTime - N hours (a timestamp in the past means it is already listed).
 */
function resolveVisibilityWindow(
  matchTime: Date,
  rawHours: number | null | undefined,
): { visibilityHours: number | null; visibleFrom: Date | null } {
  if (rawHours === null || rawHours === undefined) {
    return { visibilityHours: null, visibleFrom: null };
  }
  const hours = Math.round(Number(rawHours));
  if (!Number.isFinite(hours) || hours < MIN_VISIBILITY_HOURS || hours > MAX_VISIBILITY_HOURS) {
    throw ApiError.badRequest(
      `visibilityHours must be between ${MIN_VISIBILITY_HOURS} and ${MAX_VISIBILITY_HOURS} hours`,
    );
  }
  return { visibilityHours: hours, visibleFrom: new Date(matchTime.getTime() - hours * HOUR_MS) };
}

/** True once the match has crossed its visibleFrom threshold (null = always listed). */
function isListedForPlayersNow(visibleFrom: Date | null, nowMs: number): boolean {
  return !visibleFrom || visibleFrom.getTime() <= nowMs;
}

/** IST label used in "registration opens at ..." API messages. */
function formatIstDateTimeForMessage(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Hide room credentials unless the caller is staff (admin/sub-admin). */
function sanitizeTournament(
  t: TournamentWithMeta,
  visibleCredentials: boolean,
  nowMs: number = Date.now(),
): Record<string, unknown> {
  const { roomId, roomPassword, ...rest } = t;
  const listedNow = isListedForPlayersNow(t.visibleFrom, nowMs);
  return {
    ...rest,
    // Admin-controlled Room ID & Password reveal metadata (same rule everywhere).
    ...roomRevealMeta(t, nowMs),
    slotsBooked: t._count.slots,
    /** Whether the player feed should show this match right now. */
    isListedNow: listedNow,
    secondsUntilListed:
      listedNow || !t.visibleFrom ? 0 : Math.max(0, Math.ceil((t.visibleFrom.getTime() - nowMs) / 1000)),
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

  // Admin's player-feed visibility window ("listed only in the last N hours").
  const visibility = resolveVisibilityWindow(data.matchTime, data.visibilityHours);

  // Admin's Room ID & Password reveal window (default 15 minutes before start).
  const roomRevealMinutes = resolveRoomRevealMinutes(data.roomRevealMinutes);

  // Auto match number per tenant (1, 2, 3 …) + auto title ("Bermuda Solo #12").
  // The unique constraint on [tenantId, matchNumber] is the final safety net;
  // retry with the next number if two admins create a match at the same moment.
  let tournament: TournamentWithMeta | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const matchNumber = await nextMatchNumber(creator.tenantId);
    try {
      tournament = await prisma.tournament.create({
        data: {
          tenantId: creator.tenantId,
          title:
            data.title?.trim() ||
            autoMatchTitle(data.mapType, data.matchType, matchNumber),
          matchNumber,
          gameMode: data.gameMode,
          matchType: data.matchType,
          mapType: data.mapType,
          entryFee: data.entryFee,
          prizePool: data.prizePool,
          perKillPrize: data.perKillPrize ?? 0,
          totalSlots,
          matchTime: data.matchTime,
          ...visibility,
          roomRevealMinutes,
          status: 'OPEN',
        },
        include: { _count: { select: { slots: true } } },
      });
      break;
    } catch (err) {
      const uniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!uniqueViolation || attempt === 3) throw err;
    }
  }
  if (!tournament) throw ApiError.internal('Could not allocate a match number — retry');

  clearFeedCache();
  return sanitizeTournament(tournament, true);
}

// ─── In-Memory Feed Cache (eliminates 1.5s DB roundtrip to Supabase) ────────
interface ListCacheEntry {
  data: {
    items: Record<string, unknown>[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
  expiresAt: number;
}
const feedCache = new Map<string, ListCacheEntry>();

export function clearFeedCache() {
  feedCache.clear();
}

// ─── 2. LIST TOURNAMENTS ─────────────────────────────────────────────────

export async function listTournaments(
  tenantId: string,
  query: ListTournamentsQuery,
  viewer?: AuthUser,
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 10));

  const now = new Date();
  const nowMs = now.getTime();
  const isStaff = Boolean(viewer && (viewer.role === 'ADMIN' || viewer.role === 'SUB_ADMIN'));

  // Players only see matches inside their admin-configured visibility window.
  // Staff (admin console) always see every scheduled match. A player who has
  // already booked a seat keeps seeing "their" match even if it is hidden from
  // the generic feed (e.g. the admin shortened the window afterwards).
  const visibilityFilter: Prisma.TournamentWhereInput = isStaff
    ? {}
    : {
        OR: [
          { visibleFrom: null },
          { visibleFrom: { lte: now } },
          ...(viewer?.userId ? [{ slots: { some: { userId: viewer.userId } } }] : []),
        ],
      };

  const where: Prisma.TournamentWhereInput = {
    tenantId,
    ...(query.publishable
      ? {
          // Publish Room ID picker: hide yesterday's LIVE/COMPLETED matches.
          status: { in: [...PUBLISHABLE_STATUSES] as TournamentStatus[] },
          matchTime: { gte: new Date(nowMs - PUBLISH_GRACE_MS) },
        }
      : query.status
        ? { status: query.status as TournamentStatus }
        : {}),
    ...visibilityFilter,
    // Player feed only: never let yesterday's finished/abandoned matches fill
    // the page (they are hidden by the client too, but pagination must stay
    // correct so fresh matches are always reachable). Admin/staff keep the full
    // history; explicit status queries (COMPLETED etc.) also bypass this.
    ...(isStaff || query.status
      ? {}
      : {
          matchTime: { gte: new Date(nowMs - PLAYER_FEED_GRACE_MS) },
          status: { notIn: ['COMPLETED', 'CANCELLED'] as TournamentStatus[] },
        }),
  };

  const [total, items] = await Promise.all([
    prisma.tournament.count({ where }),
    prisma.tournament.findMany({
      where,
      include: { _count: { select: { slots: true } } },
      orderBy: { matchTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const mySlotByTournamentId = new Map<string, number>();
  if (viewer?.userId) {
    const mySlots = await prisma.tournamentSlot.findMany({
      where: {
        tournamentId: { in: items.map((t) => t.id) },
        userId: viewer.userId,
      },
      select: { tournamentId: true, slotNumber: true },
    });
    for (const slot of mySlots) {
      mySlotByTournamentId.set(slot.tournamentId, slot.slotNumber);
    }
  }

  return {
    items: items.map((t) => {
      const mySlot = mySlotByTournamentId.get(t.id);
      const isConfirmedPlayer = mySlot !== undefined;
      const roomUnlocked = isRoomUnlocked(t, nowMs);
      const hasCreds = Boolean(t.roomId && t.roomPassword);
      const canSeeCreds = isStaff || (isConfirmedPlayer && roomUnlocked && hasCreds);

      return {
        ...sanitizeTournament(t, canSeeCreds, nowMs),
        hasRoomCredentials: hasCreds,
        isRoomReady: roomUnlocked && hasCreds,
        mySlotNumber: mySlot ?? null,
        mySlot: mySlot !== undefined ? { slotNumber: mySlot } : null,
      };
    }),
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

  // Room credentials only for staff; players see them once the admin's reveal
  // window opens (or the admin pressed "Reveal Now").
  const isStaff = Boolean(viewer && (viewer.role === 'ADMIN' || viewer.role === 'SUB_ADMIN'));
  const nowMs = Date.now();
  const visibleCredentials = isStaff || isRoomUnlocked(tournament, nowMs);

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

  // Matches outside the admin's visibility window stay hidden from players
  // (unless that player already booked a seat, or is staff).
  const hiddenFromPlayers =
    Boolean(tournament.visibleFrom && tournament.visibleFrom.getTime() > nowMs);
  if (hiddenFromPlayers && !isStaff && !mySlot) {
    throw ApiError.notFound('This match has not been listed yet');
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

  return {
    ...sanitizeTournament(tournament, visibleCredentials, nowMs),
    mySlot,
  };
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
    slots: Array.from({ length: tournament.totalSlots }, (_, idx) => {
      const slotNum = idx + 1;
      const booked = slots.find((s) => s.slotNumber === slotNum);
      return booked
        ? { slotNumber: slotNum, teamId: booked.teamId, player: booked.user }
        : { slotNumber: slotNum, teamId: null, player: null };
    }),




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
  slotNumber?: number,
  teamCode?: string,
  inGameName?: string,
  inGameUid?: string,
  saveAsDefault: boolean = true,
): Promise<JoinTournamentResult> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: user.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  // Registration only opens once the admin's visibility window is reached.
  if (tournament.visibleFrom && tournament.visibleFrom.getTime() > Date.now()) {
    throw ApiError.conflict(
      `Registration is not open yet — this match appears in the list from ` +
        `${formatIstDateTimeForMessage(tournament.visibleFrom)} IST`,
    );
  }

  if (!(JOINABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Tournament is not accepting entries (status: ${tournament.status})`);
  }

  if ((inGameName || inGameUid) && saveAsDefault) {
    try {
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          ...(inGameName ? { inGameName: inGameName.trim() } : {}),
          ...(inGameUid ? { inGameUid: inGameUid.trim() } : {}),
        },
      });
    } catch {
      // Non-fatal if profile sync fails
    }
  }

  let targetSlot = slotNumber;
  if (!targetSlot || targetSlot < 1) {
    const booked = await prisma.tournamentSlot.findMany({
      where: { tournamentId },
      select: { slotNumber: true },
    });
    const bookedSet = new Set(booked.map((s) => s.slotNumber));
    for (let i = 1; i <= tournament.totalSlots; i++) {
      if (!bookedSet.has(i)) {
        targetSlot = i;
        break;
      }
    }
    if (!targetSlot) {
      throw ApiError.conflict('Tournament is full');
    }
  }

  if (targetSlot < 1 || targetSlot > tournament.totalSlots) {
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
  const reserved = await reserveSlot(tournamentId, targetSlot!, user.userId, maxSlots);
  if (!reserved.ok) {
    if (isTeamLeader && leaderTeamCode) {
      await deleteTeam(tournamentId, leaderTeamCode);
    } else if (joinedByCode) {
      await decrementTeamMembers(tournamentId, joinedByCode);
    }
    const message =
      reserved.code === 'SLOT_TAKEN'
        ? `Slot ${targetSlot} is already booked`
        : reserved.code === 'ALREADY_JOINED'
          ? 'You have already joined this tournament'
          : 'Tournament is full';
    throw ApiError.conflict(message);
  }

  const rollbackRedis = async (rawError: unknown): Promise<never> => {
    await releaseSlot(tournamentId, targetSlot, user.userId);
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
            slotNumber: targetSlot!,
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

    clearFeedCache();

    // ⚡ Realtime broadcast: slot booked & live wallet update
    try {
      const bookedCount = await prisma.tournamentSlot.count({ where: { tournamentId } });
      realtimeService.broadcastToTenant(user.tenantId, 'SLOT_BOOKED', {
        tournamentId,
        slotsBooked: bookedCount,
        totalSlots: maxSlots,
        remainingSlots: Math.max(0, maxSlots - bookedCount),
        fillFraction: Math.min(1, bookedCount / maxSlots),
        isFull: bookedCount >= maxSlots,
        status: result.status,
      });

      realtimeService.sendToUser(user.userId, 'WALLET_UPDATED', {
        userId: user.userId,
        depositBalance: String(Number(result.freshUser.depositBalance)),
        winningBalance: String(Number(result.freshUser.winningBalance)),
        totalBalance: String(Number(result.freshUser.depositBalance) + Number(result.freshUser.winningBalance)),
      });
    } catch (rtErr) {
      console.warn('[Realtime Join Broadcast Error]:', rtErr);
    }
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

      clearFeedCache();

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

  // Push: refund alert to every confirmed participant.
  void pushToTournamentParticipants(tournamentId, {
    type: 'MATCH_CANCELLED',
    tournamentId,
    title: '❌ Match Cancelled',
    body: 'Your entry fee has been refunded to your balance.',
  });

  return { tournamentId, status: 'CANCELLED', ...result };
}
// ─── 6b. 1-TAP TOURNAMENT CLONING ────────────────────────────────────────

export interface CloneTournamentInput {
  matchTime: Date;
  title?: string;
}

export async function cloneTournament(
  creator: AuthUser,
  tournamentId: string,
  input: CloneTournamentInput,
) {
  const original = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: creator.tenantId },
  });
  if (!original) throw ApiError.notFound('Original tournament not found');

  // The clone inherits the admin's visibility preference, re-anchored to the
  // new match time (so "show only in the last 10h" keeps working).
  const visibility = resolveVisibilityWindow(input.matchTime, original.visibilityHours);

  // Clones also get their own auto match number + auto title.
  let cloned: TournamentWithMeta | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const matchNumber = await nextMatchNumber(creator.tenantId);
    const newTitle =
      input.title?.trim() ||
      autoMatchTitle(original.mapType, original.matchType, matchNumber);
    try {
      cloned = await prisma.tournament.create({
        data: {
          tenantId: creator.tenantId,
          title: newTitle,
          matchNumber,
          gameMode: original.gameMode,
          matchType: original.matchType,
          mapType: original.mapType,
          entryFee: original.entryFee,
          prizePool: original.prizePool,
          perKillPrize: original.perKillPrize,
          totalSlots: original.totalSlots,
          matchTime: input.matchTime,
          ...visibility,
          roomRevealMinutes: original.roomRevealMinutes,
          status: 'OPEN',
        },
        include: { _count: { select: { slots: true } } },
      });
      break;
    } catch (err) {
      const uniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!uniqueViolation || attempt === 3) throw err;
    }
  }
  if (!cloned) throw ApiError.internal('Could not allocate a match number — retry');

  clearFeedCache();
  return sanitizeTournament(cloned, true);
}

// ─── 7. UPDATE PLAYER-FEED VISIBILITY WINDOW ─────────────────────────────

export interface UpdateVisibilityInput {
  /** null = list immediately; N = list only in the last N hours. */
  visibilityHours: number | null;
}

/**
 * Admin can tune when a match becomes visible to players after creation
 * (e.g. hide an evening match until 6 hours before start).
 */
export async function updateTournamentVisibility(
  adminUser: AuthUser,
  tournamentId: string,
  input: UpdateVisibilityInput,
) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId: adminUser.tenantId },
  });
  if (!tournament) throw ApiError.notFound('Tournament not found');

  if (!(VISIBILITY_EDITABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(
      `Cannot change visibility for a match in status ${tournament.status}`,
    );
  }

  const window = resolveVisibilityWindow(tournament.matchTime, input.visibilityHours);

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: window,
    include: { _count: { select: { slots: true } } },
  });

  clearFeedCache();
  return sanitizeTournament(updated, true);
}
