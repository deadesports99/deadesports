import { randomUUID } from 'node:crypto';
import { Prisma, type TournamentStatus } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { noteDeviceActivity } from './deviceWatch.service.js';
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

/**
 * Entry closes this long before kickoff: with a 6:00 PM match no one can join
 * from 5:59 PM, so the batch and the room list are frozen before play starts.
 */
export const JOIN_CUTOFF_MS = 60 * 1000;

/** Tournament statuses from which an admin may cancel + refund. */
const CANCELLABLE_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;

/** Statuses a player may still book a seat in (ROOM_REVEALED is included: a
 *  published room does not close the entry window — only kickoff-1min does). */
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
  broadcastFeedChanged(tournament.tenantId, tournament.id, tournament.status, 'CREATED');
  return sanitizeTournament(tournament, true);
}

/**
 * Tell every connected player "the feed changed, re-fetch it".
 *
 * Joins and results already push SLOT_BOOKED / MATCH_STATUS_CHANGED, but a
 * brand-new match had no event at all: the DB row existed while the app kept
 * rendering its cached list until someone tapped refresh. MATCH_CREATED is
 * deliberately status-agnostic — clients just call GET /tournaments again, so
 * visibility rules, pagination and ordering stay server-authoritative.
 */
function broadcastFeedChanged(
  tenantId: string,
  tournamentId: string,
  status: string,
  reason: 'CREATED' | 'CLONED' | 'VISIBILITY_UPDATED' | 'CANCELLED' | 'UPDATED',
): void {
  try {
    realtimeService.broadcastToTenant(tenantId, 'MATCH_CREATED', {
      tournamentId,
      status,
      reason,
    });
  } catch (rtErr) {
    console.warn('[Realtime Feed Broadcast Error]:', rtErr);
  }
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
  /** Present when the organiser already published the room before this join. */
  roomId?: string | null;
}

/** A lost seat race — the caller retries on the next free seat. */
class JoinRaceLoss extends Error {}

/** Prisma errors are duck-typed: `instanceof` is unreliable across client builds. */
function prismaCodeOf(error: unknown): string | undefined {
  return (error as { code?: unknown } | null | undefined)?.code as string | undefined;
}

function prismaTargetOf(error: unknown): string {
  const meta = (error as { meta?: { target?: unknown } } | null | undefined)?.meta;
  return String(meta?.target ?? '');
}

/**
 * True when the failure is "someone else got there first" and a retry on the
 * next free seat can succeed: seat unique-violation, serialization conflict,
 * transaction timeout, or a saturated connection pool.
 */
function isJoinRaceLoss(error: unknown): boolean {
  if (error instanceof JoinRaceLoss) return true;
  const code = prismaCodeOf(error);
  if (!code) return false;
  // Pool starvation / transaction timeouts are capacity problems, not seat races.
  // Retrying them multiplies the load, so they surface as a clean "busy" message.
  if (code === 'P2034' || code === 'P2028') return true;
  if (code === 'P2024') return false;
  if (code === 'P2002') {
    const target = prismaTargetOf(error);
    // Seat unique index (tournamentId, slotNumber) — never the user index.
    return !target.includes('userId');
  }
  return false;
}

/** Turn a leftover Prisma failure into a clean 4xx for the app. */
function mapJoinError(error: unknown): Error {
  if (process.env.JOIN_DEBUG === '1') {
    const e = error as { name?: string; code?: string; message?: string };
    console.error('[join-debug]', e?.name, e?.code, e?.message);
  }
  const code = prismaCodeOf(error);
  if (code === 'P2002') {
    return prismaTargetOf(error).includes('userId')
      ? ApiError.conflict('You have already joined this tournament')
      : ApiError.conflict('That seat was just taken — please try again');
  }
  if (code === 'P2034') return ApiError.conflict('Booking conflict — please retry');
  if (code === 'P2024' || code === 'P2028') {
    return ApiError.serviceUnavailable('The server is busy right now — please tap join again');
  }
  const message = String((error as { message?: string } | null)?.message ?? '');
  if (/timeout exceeded when trying to connect|Connection pool|ECONNRESET/i.test(message)) {
    return ApiError.serviceUnavailable('The server is busy right now — please tap join again');
  }
  return error instanceof Error ? error : new Error('Booking failed');
}

/** Everything the join path needs from the match row, in one query. */
interface JoinMatch {
  id: string;
  status: string;
  visibleFrom: Date | null;
  matchTime: Date;
  totalSlots: number;
  entryFee: string;
  title: string;
  roomId: string | null;
  roomRevealedAt: Date | null;
  matchType: string;
  /** Seats already taken (read in the same round-trip). */
  bookedCount: number;
  /** Lowest free seat number, or null when the match is full. */
  freeSlot: number | null;
}

/** Minimal shape shared by PrismaClient and its transaction client. */
type JoinDb = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * Match row + booked count + lowest free seat in ONE round-trip.
 *
 * The join path used to spend three queries here (find match, list every booked
 * seat, then count them again inside the transaction). Against a remote database
 * each round-trip is ~200 ms, so fusing them is the difference between a ~2.4 s
 * and a ~1 s join.
 */
/**
 * Closes an over-full match even when two joins raced past each other.
 *
 * The in-transaction flip counts the seats *this* transaction can see, so with
 * two last-seat joins in flight both may read 47 booked and neither flips the
 * status (the match then sits in OPEN with 48/48). This single conditional
 * UPDATE runs after the commit, where the true count is visible, and only ever
 * touches a match that is genuinely full.
 *
 * @returns the status the match ends up in, or null when nothing changed.
 */
async function reconcileFullStatus(tournamentId: string): Promise<string | null> {
  const rows = (await prisma.$queryRaw`
    UPDATE "Tournament" t
       SET status = 'SLOTS_FULL'
     WHERE t.id = ${tournamentId}
       AND t.status IN ('OPEN', 'UPCOMING', 'DRAFT')
       AND (SELECT count(*) FROM "TournamentSlot" s
             WHERE s."tournamentId" = t.id) >= t."totalSlots"
    RETURNING t.status`) as Array<{ status: string }>;
  return rows[0]?.status ?? null;
}

async function loadJoinContext(
  db: JoinDb,
  tournamentId: string,
  tenantId: string,
  /**
   * `true` on a retry after losing a seat race.
   *
   * Every join asks for the *lowest* free seat, so N simultaneous joins all aim
   * at the same number and N-1 of them lose. On a retry we pick a random free
   * seat instead: the crowd spreads over the free seats and the second attempt
   * wins immediately.
   */
  randomSeat = false,
): Promise<JoinMatch | null> {
  const freeSlot =
    randomSeat
      ? Prisma.sql`(SELECT gs FROM generate_series(1, t."totalSlots") gs
             WHERE NOT EXISTS (SELECT 1 FROM "TournamentSlot" s2
                                WHERE s2."tournamentId" = t.id AND s2."slotNumber" = gs)
             ORDER BY random() LIMIT 1)`
      : Prisma.sql`(SELECT gs FROM generate_series(1, t."totalSlots") gs
             WHERE NOT EXISTS (SELECT 1 FROM "TournamentSlot" s2
                                WHERE s2."tournamentId" = t.id AND s2."slotNumber" = gs)
             ORDER BY gs LIMIT 1)`;

  const rows = (await db.$queryRaw`
    SELECT t.id,
           t.status,
           t."visibleFrom",
           t."matchTime",
           t."totalSlots",
           t."entryFee",
           t.title,
           t."roomId",
           t."roomRevealedAt",
           t."matchType",
           (SELECT count(*)::int FROM "TournamentSlot" s
             WHERE s."tournamentId" = t.id) AS "bookedCount",
           ${freeSlot} AS "freeSlot"
      FROM "Tournament" t
     WHERE t.id = ${tournamentId} AND t."tenantId" = ${tenantId}
     LIMIT 1`) as JoinMatch[];
  return rows[0] ?? null;
}

/**
 * Join concurrency gate.
 *
 * Why: a nearly-full match turns into a stampede — 100+ taps at the same
 * instant, all wanting the last seat. Supabase's session pooler only gives us
 * 15 server connections, so without a gate Prisma's own pool spills
 * `P2024 timeout exceeded when trying to connect` (a 500/503) for the overflow.
 *
 * Here the queue lives in memory instead: at most JOIN_MAX_INFLIGHT joins touch
 * the DB at once, the rest wait their turn (which is fine — the seat is decided
 * by the DB, not by who asked first) and overflow past JOIN_MAX_QUEUE is told
 * to retry instead of being queued forever.
 */
const JOIN_MAX_INFLIGHT = Math.max(1, Number(process.env.JOIN_MAX_INFLIGHT ?? 12));
const JOIN_MAX_QUEUE = Math.max(1, Number(process.env.JOIN_MAX_QUEUE ?? 400));

let joinsInflight = 0;
const joinWaiters: Array<() => void> = [];

function acquireJoinSlot(): Promise<void> {
  if (joinsInflight < JOIN_MAX_INFLIGHT) {
    joinsInflight += 1;
    return Promise.resolve();
  }
  if (joinWaiters.length >= JOIN_MAX_QUEUE) {
    return Promise.reject(ApiError.serviceUnavailable('Everyone is joining this match right now — please tap join again'));
  }
  return new Promise<void>((resolve) => {
    joinWaiters.push(() => {
      joinsInflight += 1;
      resolve();
    });
  });
}

function releaseJoinSlot(): void {
  joinsInflight = Math.max(0, joinsInflight - 1);
  const next = joinWaiters.shift();
  if (next) next();
}

/**
 * Player-facing words for "no seats left".
 *
 * A burst on the last seats used to answer with
 * "Tournament is not accepting entries (status: SLOTS_FULL)" — that is a
 * database status, not something a player should ever read. The app shows this
 * string verbatim (join sheet message) and turns the join button into "Slot Full".
 */
export const SLOT_FULL_MESSAGE = 'Slot Full — all seats are taken';
export const ENTRY_CLOSED_MESSAGE = 'Entry closed — this match is no longer accepting players';

/** Maps a non-joinable match status to the sentence the player sees. */
function closedStatusMessage(status: string | null | undefined): string {
  return status === 'SLOTS_FULL' ? SLOT_FULL_MESSAGE : ENTRY_CLOSED_MESSAGE;
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
  await acquireJoinSlot();
  try {
    return await joinTournamentInner(user, tournamentId, slotNumber, teamCode, inGameName, inGameUid, saveAsDefault);
  } finally {
    releaseJoinSlot();
  }
}

async function joinTournamentInner(
  user: AuthUser,
  tournamentId: string,
  slotNumber?: number,
  teamCode?: string,
  inGameName?: string,
  inGameUid?: string,
  saveAsDefault: boolean = true,
): Promise<JoinTournamentResult> {
  // One round-trip for the match row, the booked count and the lowest free seat.
  const loaded = await loadJoinContext(prisma, tournamentId, user.tenantId);
  if (!loaded) throw ApiError.notFound('Tournament not found');

  /** Non-null alias: TS narrowing does not reach the nested retry helper. */
  const matchRow = loaded;
  const tournament = loaded;

  // Registration only opens once the admin's visibility window is reached.
  if (tournament.visibleFrom && tournament.visibleFrom.getTime() > Date.now()) {
    throw ApiError.conflict(
      `Registration is not open yet — this match appears in the list from ` +
        `${formatIstDateTimeForMessage(tournament.visibleFrom)} IST`,
    );
  }

  // A published Room ID & Password means players are already filing into the
  // custom room. Publishing the room also flips the match to ROOM_REVEALED, so
  // that status must still accept entries — otherwise a player who was not
  // seated before the publish could never join (old bug: "join is blocked
  // although the match has not started yet").
  const roomPublished = Boolean(tournament.roomRevealedAt || tournament.status === 'ROOM_REVEALED');

  if (!(JOINABLE_STATUSES as readonly string[]).includes(tournament.status) && !roomPublished) {
    throw ApiError.conflict(closedStatusMessage(tournament.status));
  }

  // Joining closes 1 minute before the match starts (see JOIN_CUTOFF_MS) — this
  // is the ONLY time rule, and it does not care whether the room was published.
  if (tournament.matchTime.getTime() - Date.now() <= JOIN_CUTOFF_MS) {
    throw ApiError.conflict(
      'Entry closed — joining stops 1 minute before the match starts',
    );
  }

  // ── Concurrency: seat races are retried, never surfaced as 500s ─────
  // Two players tapping the same free seat at the same instant is normal on a
  // hot match. The DB is the source of truth (unique seat + serializable tx),
  // so a lost race is retried on the next free seat instead of failing.
const MAX_JOIN_ATTEMPTS = 8;
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= MAX_JOIN_ATTEMPTS; attempt += 1) {
    try {
      return await joinOnce(attempt > 1);
    } catch (err) {
      if (!isJoinRaceLoss(err)) throw mapJoinError(err);
      if (attempt === MAX_JOIN_ATTEMPTS) break;
      await wait(5 + attempt * 8 + Math.floor(Math.random() * 12));
    }
  }
  throw ApiError.conflict('Every seat is being taken right now — please tap join again');

  /** One full join attempt: pick a free seat, reserve it, commit the DB tx. */
  async function joinOnce(randomSeat: boolean): Promise<JoinTournamentResult> {
    const tournament = matchRow;
    const teamSize = getTeamSize(tournament.matchType);
    const maxSlots = tournament.totalSlots;

    // An explicit seat tap wins; otherwise the transaction itself picks the
    // lowest free seat (fresh inside the tx) — no extra round-trip needed here.
    const requestedSlot = slotNumber && slotNumber > 0 ? slotNumber : undefined;
    if (requestedSlot && requestedSlot > maxSlots) {
      throw ApiError.badRequest(`slotNumber must be between 1 and ${maxSlots}`);
    }
    let targetSlot = requestedSlot ?? tournament.freeSlot ?? undefined;
    if (!targetSlot) throw ApiError.conflict(SLOT_FULL_MESSAGE);

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


    // ── Redis atomic seat reservation (no-op when Redis is offline) ────
    const reserved = await reserveSlot(tournamentId, targetSlot!, user.userId, maxSlots);
    if (!reserved.ok) {
      if (isTeamLeader && leaderTeamCode) {
        await deleteTeam(tournamentId, leaderTeamCode);
      } else if (joinedByCode) {
        await decrementTeamMembers(tournamentId, joinedByCode);
      }
      if (reserved.code === 'SLOT_TAKEN') throw new JoinRaceLoss('seat taken during reservation');
      if (reserved.code === 'ALREADY_JOINED') {
        throw ApiError.conflict('You have already joined this tournament');
      }
      throw ApiError.conflict(SLOT_FULL_MESSAGE);
    }

    /** Give the reserved seat back when this attempt does not reach the DB. */
    const releaseReservation = async (): Promise<void> => {
      await releaseSlot(tournamentId, targetSlot!, user.userId);
      if (isTeamLeader && leaderTeamCode) {
        await deleteTeam(tournamentId, leaderTeamCode);
      } else if (joinedByCode) {
        await decrementTeamMembers(tournamentId, joinedByCode);
      }
    };

    try {
        const result = await prisma.$transaction(
          async (tx) => {
            // Re-check tournament status inside the transaction (fresh read).
            // A published room (ROOM_REVEALED) may still take entries until the
            // kickoff-1min cutoff, so it must pass this guard too.
            // Same fused query inside the transaction: fresh status + seat count.
            const liveTournament = await loadJoinContext(
              tx as unknown as JoinDb,
              tournamentId,
              user.tenantId,
              randomSeat,
            );
            const liveRoomPublished = Boolean(
              liveTournament?.roomRevealedAt || liveTournament?.status === 'ROOM_REVEALED',
            );
            if (
              !liveTournament ||
              (!(JOINABLE_STATUSES as readonly string[]).includes(liveTournament.status) && !liveRoomPublished)
            ) {
              throw ApiError.conflict(closedStatusMessage(liveTournament?.status));
            }
            // The outer check can be stale by a few seconds — enforce the
            // 1-minute cutoff against the fresh row as well.
            if (liveTournament.matchTime.getTime() - Date.now() <= JOIN_CUTOFF_MS) {
              throw ApiError.conflict('Entry closed — joining stops 1 minute before the match starts');
            }

            // The seat is chosen here, inside the transaction, so it is fresh even
            // when the retry loop runs after losing a race.
            const seat = requestedSlot ?? liveTournament.freeSlot;
            if (!seat) throw ApiError.conflict(SLOT_FULL_MESSAGE);

            // 1) Conditional atomic balance debit — one round-trip that also returns
            //    the fresh balances and the profile values for the seat snapshot.
            const fee = tournament.entryFee;
            type Balances = {
              depositBalance: string;
              winningBalance: string;
              inGameName: string | null;
              inGameUid: string | null;
              deviceId: string | null;
            };
            const depositRows = (await tx.$queryRaw`
              UPDATE "User"
                 SET "depositBalance" = "depositBalance" - ${fee}::numeric
               WHERE id = ${user.userId} AND "isBanned" = false AND "depositBalance" >= ${fee}::numeric
              RETURNING "depositBalance", "winningBalance", "inGameName", "inGameUid", "deviceId"`) as Balances[];
            let balanceType: 'DEPOSIT' | 'WINNING' = 'DEPOSIT';
            let freshUser = depositRows[0];

            if (!freshUser) {
              // Fall back to the winning balance if the deposit balance is short.
              const winningRows = (await tx.$queryRaw`
                UPDATE "User"
                   SET "winningBalance" = "winningBalance" - ${fee}::numeric
                 WHERE id = ${user.userId} AND "isBanned" = false AND "winningBalance" >= ${fee}::numeric
                RETURNING "depositBalance", "winningBalance", "inGameName", "inGameUid", "deviceId"`) as Balances[];
              freshUser = winningRows[0];
              if (!freshUser) {
                throw ApiError.badRequest('Insufficient balance to join this tournament');
              }
              balanceType = 'WINNING';
            }

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
            //    The IGN / FF UID / device are snapshotted here so a later profile
            //    edit can never rewrite this match's identity (reward disputes,
            //    cheat reports). Typed values win over the stored profile.
            const snapshotName =
              inGameName?.trim() || freshUser.inGameName?.trim() || null;
            const snapshotUid =
              inGameUid?.trim() || freshUser.inGameUid?.trim() || null;
            const slot = await tx.tournamentSlot.create({
              data: {
                tournamentId,
                userId: user.userId,
                slotNumber: seat,
                teamId: teamId ?? null,
                inGameNameSnapshot: snapshotName,
                inGameUidSnapshot: snapshotUid,
                deviceIdSnapshot: freshUser.deviceId?.trim() || null,
              },
            });

            // 3b) Persist the game identity as the player's new default. Overwrites the
            //     previous IGN/UID (no history row), so the next join pre-fills the latest
            //     values the player entered.
            if (saveAsDefault && (inGameName?.trim() || inGameUid?.trim())) {
              await tx.user.update({
                where: { id: user.userId },
                data: {
                  ...(inGameName?.trim() ? { inGameName: inGameName.trim() } : {}),
                  ...(inGameUid?.trim() ? { inGameUid: inGameUid.trim() } : {}),
                },
              });
            }

            // 4) Flip to SLOTS_FULL the moment the last seat is taken. The seat count
            //    comes from the fused query above (+1 for the seat we just inserted),
            //    so no extra COUNT round-trip is needed.
            const booked = liveTournament.bookedCount + 1;
            let status = liveTournament.status;
            if (booked >= maxSlots && status !== 'SLOTS_FULL') {
              await tx.tournament.update({
                where: { id: tournamentId },
                data: { status: 'SLOTS_FULL' },
              });
              status = 'SLOTS_FULL';
            }

            return { slot, freshUser, status, bookedCount: booked };
          },
          {
            // ReadCommitted on purpose: the unique (tournamentId, slotNumber) index
            // stops double-selling a seat, the conditional updateMany debit stops a
            // negative wallet, and (tournamentId, userId) stops a double join.
            // Serializable made 50 simultaneous joins queue for ~10s each and time
            // out (P2034) instead of failing fast and retrying the next free seat.
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            // Queue behind the pool instead of throwing: a player would rather wait
            // a second longer than get "busy" while seats are still free.
            maxWait: 30000,
            timeout: 20000,
          },
        );

        clearFeedCache();

        // ⚡ Realtime broadcast: slot booked & live wallet update
        try {
          const bookedCount = result.bookedCount;
          // The last seat may have been taken by a transaction we could not see
          // from inside ours — settle the status with the post-commit count.
          const finalStatus = (await reconcileFullStatus(tournamentId)) ?? result.status;
          result.status = finalStatus;
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

        // 🔭 Watchlist: if this device is being watched, note the fresh activity.
        // Fire-and-forget — anti-cheat bookkeeping must never block a join.
        void noteDeviceActivity(
          user.tenantId,
          result.slot.deviceIdSnapshot ?? null,
          user.userId,
        );

        return {
          slotNumber: result.slot.slotNumber,
          teamId: result.slot.teamId,
          ...(leaderTeamCode ? { teamCode: leaderTeamCode } : {}),
          entryFee: Number(tournament.entryFee),
          balanceAfter: Number(result.freshUser.depositBalance) + Number(result.freshUser.winningBalance),
          tournamentStatus: result.status,
          // The room may already be published: the app can show the code right away.
          roomId: tournament.roomId,
        };

    } catch (err) {
      // Never leave a Redis seat or a squad code dangling when the DB says no.
      await releaseReservation();
      throw err;
    }
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

  // Players still listing the match must drop it now, not on their next refresh.
  broadcastFeedChanged(adminUser.tenantId, tournamentId, 'CANCELLED', 'CANCELLED');

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
  broadcastFeedChanged(cloned.tenantId, cloned.id, cloned.status, 'CLONED');
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
  broadcastFeedChanged(updated.tenantId, updated.id, updated.status, 'VISIBILITY_UPDATED');
  return sanitizeTournament(updated, true);
}
