import type { Prisma, TournamentStatus } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { isRoomUnlocked } from './roomReveal.js';
import { getPlayerStats, type PlayerStats } from './player.service.js';

/**
 * 🕘 MY MATCHES — a player's own match history.
 *
 * The lobby feed deliberately drops finished matches (COMPLETED / CANCELLED and
 * anything older than the 3-hour grace window), so this is the only read path
 * that shows a player what happened in a match they actually paid for:
 * the seat, the verified result (rank / kills / prize) and the money outcome
 * (entry fee, refund, net).
 *
 * Everything is derived from rows that already exist — no new columns, no
 * duplicated counters:
 *   TournamentSlot → which match + which seat + the join-time IGN snapshot
 *   MatchResult    → spectator-verified rank, kills, prize, disqualification
 *   WalletLedger   → JOIN_FEE (money in) and REFUND rows (money back)
 *
 * The room-code rule is identical to the feed (`isRoomUnlocked`): a player only
 * ever receives a Room ID & Password that staff has published.
 */

export type MyMatchBucket = 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled';

export const MY_MATCH_BUCKETS: readonly MyMatchBucket[] = [
  'all',
  'upcoming',
  'live',
  'completed',
  'cancelled',
];

/**
 * Waiting for kickoff / room. STARTING_SOON belongs here on purpose: the match
 * has not started (only the organiser can start it), so it must stay in the
 * "upcoming" bucket and keep its seat visible.
 */
const CURRENT_STATUSES = ['UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'STARTING_SOON'] as const;
/** On the map right now. */
const LIVE_STATUSES = ['LIVE'] as const;
/** Finished, including the short window where the scorer is still verifying. */
const PAST_STATUSES = ['UNDER_REVIEW', 'COMPLETED', 'CANCELLED'] as const;
/** Finished matches that count as "played". */
const COMPLETED_STATUSES = ['UNDER_REVIEW', 'COMPLETED'] as const;
const CANCELLED_STATUSES = ['CANCELLED'] as const;

/** Exported so the UI, tests and this service can never disagree on a bucket. */
export function statusesForBucket(bucket: MyMatchBucket): readonly TournamentStatus[] | null {
  switch (bucket) {
    case 'all':
      return null; // two-phase: current first, then past
    case 'upcoming':
      return CURRENT_STATUSES as unknown as TournamentStatus[];
    case 'live':
      return LIVE_STATUSES as unknown as TournamentStatus[];
    case 'completed':
      return COMPLETED_STATUSES as unknown as TournamentStatus[];
    case 'cancelled':
      return CANCELLED_STATUSES as unknown as TournamentStatus[];
    default:
      throw ApiError.badRequest(`bucket must be one of: ${MY_MATCH_BUCKETS.join(', ')}`);
  }
}

export type MyMatchPhase = 'upcoming' | 'live' | 'completed' | 'cancelled';

/** The phase a single row belongs to — the card's status pill follows this. */
export function phaseForStatus(status: string): MyMatchPhase {
  if ((LIVE_STATUSES as readonly string[]).includes(status)) return 'live';
  if ((CANCELLED_STATUSES as readonly string[]).includes(status)) return 'cancelled';
  if ((COMPLETED_STATUSES as readonly string[]).includes(status)) return 'completed';
  return 'upcoming';
}

export interface MyMatchResultView {
  rank: number | null;
  kills: number;
  prizeWon: number;
  isApproved: boolean;
  isDisqualified: boolean;
  disqualifyReason: string | null;
}

export interface MyMatchItem {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  /** ISO date — the card formats it in IST like the feed does. */
  matchTime: Date;
  status: string;
  phase: MyMatchPhase;
  entryFee: number;
  perKillPrize: number;
  slotNumber: number;
  joinedAt: Date;
  /** Identity frozen at join time (anti-cheat proof for reward disputes). */
  inGameNameSnapshot: string | null;
  inGameUidSnapshot: string | null;
  /** Match-scoped ban — the account itself may still be fine. */
  isBannedFromMatch: boolean;
  banReason: string | null;
  roomUnlocked: boolean;
  /** Present only when staff published the credentials AND this player is seated. */
  room: { roomId: string | null; roomPassword: string | null } | null;
  result: MyMatchResultView | null;
  /** True when a REFUND ledger row exists for this match. */
  refunded: boolean;
  refundAmount: number;
  /** prizeWon + refundAmount − entryFee, only once the match is settled. */
  net: number | null;
}

export interface MyMatchesSummary extends PlayerStats {
  upcomingCount: number;
  liveCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface MyMatchesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MyMatchesPage {
  items: MyMatchItem[];
  pagination: MyMatchesPagination;
  summary: MyMatchesSummary;
}

type SlotRow = {
  tournamentId: string;
  slotNumber: number;
  joinedAt: Date;
  inGameNameSnapshot?: string | null;
  inGameUidSnapshot?: string | null;
  isBanned?: boolean;
  banReason?: string | null;
  tournament: {
    matchNumber: number | null;
    title: string;
    gameMode: string;
    matchType: string;
    mapType: string;
    matchTime: Date;
    status: string;
    entryFee: unknown;
    perKillPrize: unknown;
    roomId: string | null;
    roomPassword: string | null;
    roomRevealedAt: Date | null;
    roomRevealMinutes: number | null;
  };
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** `where` for one player's seats inside a tenant (optionally a status slice). */
function slotWhere(
  userId: string,
  tenantId: string,
  statuses: readonly TournamentStatus[] | null,
): Prisma.TournamentSlotWhereInput {
  return {
    userId,
    tournament: {
      tenantId,
      ...(statuses ? { status: { in: statuses as TournamentStatus[] } } : {}),
    },
  };
}

function findSlots(
  where: Prisma.TournamentSlotWhereInput,
  direction: 'asc' | 'desc',
  skip: number,
  take: number,
) {
  return prisma.tournamentSlot.findMany({
    where,
    include: { tournament: true },
    orderBy: { tournament: { matchTime: direction } },
    skip,
    take,
  });
}

/**
 * The latest page across "still relevant" and "already finished" rows.
 *
 * `all` cannot be a single ordered query: a match next week must sit above one
 * from yesterday, but among finished matches the newest belongs on top. So the
 * page window is sliced over two ordered segments (current ASC, past DESC)
 * using counts, and only the needed rows are read.
 */
async function pageAcrossPhases(
  userId: string,
  tenantId: string,
  page: number,
  limit: number,
): Promise<{ rows: SlotRow[]; total: number }> {
  const currentWhere = slotWhere(userId, tenantId, [
    ...CURRENT_STATUSES,
    ...LIVE_STATUSES,
  ] as unknown as TournamentStatus[]);
  const pastWhere = slotWhere(userId, tenantId, PAST_STATUSES as unknown as TournamentStatus[]);

  const [currentCount, pastCount] = await Promise.all([
    prisma.tournamentSlot.count({ where: currentWhere }),
    prisma.tournamentSlot.count({ where: pastWhere }),
  ]);
  const total = currentCount + pastCount;
  const start = (page - 1) * limit;

  const currentSkip = Math.min(start, currentCount);
  const currentTake = Math.max(0, Math.min(limit, currentCount - start));
  const pastSkip = Math.max(0, start - currentCount);
  const pastTake = limit - currentTake;

  const [currentRows, pastRows] = await Promise.all([
    currentTake > 0 ? findSlots(currentWhere, 'asc', currentSkip, currentTake) : Promise.resolve([]),
    pastTake > 0 ? findSlots(pastWhere, 'desc', pastSkip, pastTake) : Promise.resolve([]),
  ]);

  return { rows: [...(currentRows as SlotRow[]), ...(pastRows as SlotRow[])], total };
}

/** One extra read for the summary strip: how many matches sit in each phase. */
async function phaseCounts(userId: string, tenantId: string) {
  const rows = await prisma.tournamentSlot.findMany({
    where: { userId, tournament: { tenantId } },
    include: { tournament: { select: { status: true } } },
  });

  const counts = { upcomingCount: 0, liveCount: 0, completedCount: 0, cancelledCount: 0 };
  for (const row of rows as unknown as Array<{ tournament: { status: string } | null }>) {
    const status = row.tournament?.status;
    if (!status) continue;
    const phase = phaseForStatus(status);
    if (phase === 'upcoming') counts.upcomingCount += 1;
    else if (phase === 'live') counts.liveCount += 1;
    else if (phase === 'completed') counts.completedCount += 1;
    else counts.cancelledCount += 1;
  }
  return counts;
}

/**
 * Career totals + phase counters for the "My Matches" header strip.
 * Reuses `getPlayerStats` so the numbers match the Profile screen exactly.
 */
export async function getMyMatchesSummary(
  userId: string,
  tenantId: string,
): Promise<MyMatchesSummary> {
  const [stats, counts] = await Promise.all([
    getPlayerStats(userId, tenantId),
    phaseCounts(userId, tenantId),
  ]);
  return { ...stats, ...counts };
}

/**
 * A page of the player's own matches, newest-relevant first.
 *
 * @param bucket 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled'
 */
export async function getMyMatches(
  userId: string,
  tenantId: string,
  options: { bucket?: MyMatchBucket; page?: number; limit?: number } = {},
): Promise<MyMatchesPage> {
  const bucket = options.bucket ?? 'all';
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 20)));
  const statuses = statusesForBucket(bucket);

  let rows: SlotRow[];
  let total: number;

  if (statuses === null) {
    const across = await pageAcrossPhases(userId, tenantId, page, limit);
    rows = across.rows;
    total = across.total;
  } else {
    const where = slotWhere(userId, tenantId, statuses);
    const [count, found] = await Promise.all([
      prisma.tournamentSlot.count({ where }),
      findSlots(where, 'desc', (page - 1) * limit, limit),
    ]);
    rows = found as SlotRow[];
    total = count;
  }

  const [items, summary] = await Promise.all([
    decorateSlots(rows, userId, Date.now()),
    getMyMatchesSummary(userId, tenantId),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary,
  };
}

/**
 * Attach result + refund + room state to each seat with three batched reads
 * (never one query per card).
 */
async function decorateSlots(
  rows: SlotRow[],
  userId: string,
  nowMs: number,
): Promise<MyMatchItem[]> {
  if (rows.length === 0) return [];
  const tournamentIds = rows.map((row) => row.tournamentId);

  const [results, refunds] = await Promise.all([
    prisma.matchResult.findMany({
      where: { userId, tournamentId: { in: tournamentIds } },
      select: {
        tournamentId: true,
        rank: true,
        verifiedKills: true,
        prizeWon: true,
        isApproved: true,
        isDisqualified: true,
        disqualifyReason: true,
      },
    }),
    prisma.walletLedger.findMany({
      where: {
        userId,
        category: 'REFUND',
        referenceId: { in: tournamentIds },
      },
      select: { referenceId: true, amount: true },
    }),
  ]);

  const resultByTournament = new Map<string, (typeof results)[number]>();
  for (const result of results) resultByTournament.set(result.tournamentId, result);

  // A match can only be refunded once, but summing is safe if it ever retries.
  const refundByTournament = new Map<string, number>();
  for (const entry of refunds) {
    if (!entry.referenceId) continue;
    const previous = refundByTournament.get(entry.referenceId) ?? 0;
    refundByTournament.set(entry.referenceId, previous + num(entry.amount));
  }

  return rows.map((row) => {
    const t = row.tournament;
    const status = t.status;
    const phase = phaseForStatus(status);
    const entryFee = num(t.entryFee);
    const refundAmount = refundByTournament.get(row.tournamentId) ?? 0;
    const found = resultByTournament.get(row.tournamentId);
    const roomUnlocked = isRoomUnlocked(t, nowMs);
    const hasCredentials = Boolean(t.roomId && t.roomPassword);
    // A settled match still has no money outcome until either the scorer
    // published a result or the refund landed — until then `net` stays null so
    // the card never shows a loss that may not be real.
    const settled =
      (phase === 'completed' || phase === 'cancelled') &&
      (found !== undefined || refundAmount > 0);
    const prizeWon = found ? num(found.prizeWon) : 0;

    return {
      id: row.tournamentId,
      matchNumber: t.matchNumber ?? null,
      title: t.title,
      gameMode: t.gameMode,
      matchType: t.matchType,
      mapType: t.mapType,
      matchTime: t.matchTime,
      status,
      phase,
      entryFee: round2(entryFee),
      perKillPrize: round2(num(t.perKillPrize)),
      slotNumber: row.slotNumber,
      joinedAt: row.joinedAt,
      inGameNameSnapshot: row.inGameNameSnapshot ?? null,
      inGameUidSnapshot: row.inGameUidSnapshot ?? null,
      isBannedFromMatch: row.isBanned === true,
      banReason: row.banReason ?? null,
      roomUnlocked,
      room: roomUnlocked && hasCredentials
        ? { roomId: t.roomId, roomPassword: t.roomPassword }
        : null,
      result: found
        ? {
            rank: found.rank ?? null,
            kills: num(found.verifiedKills),
            prizeWon: round2(prizeWon),
            isApproved: found.isApproved === true,
            isDisqualified: found.isDisqualified === true,
            disqualifyReason: found.disqualifyReason ?? null,
          }
        : null,
      refunded: refundAmount > 0,
      refundAmount: round2(refundAmount),
      net: settled ? round2(prizeWon + refundAmount - entryFee) : null,
    };
  });
}
