import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { TournamentStatus } from '../generated/prisma/client.js';
import { realtimeService } from './realtime.service.js';
import { DEFAULT_ROOM_REVEAL_MINUTES, MINUTE_MS } from './roomReveal.js';

/**
 * 🕒 MATCH STATE-MACHINE SWEEP
 *
 * Only two things are time driven now:
 *
 *   UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED ──(kickoff)──► LIVE ──(2h)──► UNDER_REVIEW
 *
 * The room is **never** revealed on a clock: players see the custom Room ID &
 * Password only after an admin/sub-admin publishes them (see roomReveal.ts).
 * Joining closes 1 minute before kickoff (enforced in joinTournament).
 *
 * Safe to run every minute and right after a restart: every transition is a
 * conditional `updateMany` guard, so two concurrent sweeps cannot double-fire.
 */

/** Default reveal window (legacy export — per-match value lives on Tournament). */
export const ROOM_REVEAL_WINDOW_MS = DEFAULT_ROOM_REVEAL_MINUTES * MINUTE_MS;

/** Not-yet-started statuses that must flip to LIVE at kickoff. */
const PRE_MATCH_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;

/**
 * A LIVE match auto-moves to UNDER_REVIEW this long after kickoff, so the
 * player app stops showing "Live In-Progress" for yesterday's matches while the
 * admin keeps a proper history (and can still enter results / 1-click payout).
 */
export const LIVE_TO_REVIEW_MS = 2 * 60 * 60 * 1000;

export interface SweptMatch {
  id: string;
  title: string;
  matchTime: Date;
}

export interface SweepResult {
  ranAt: string;
  wentLive: SweptMatch[];
  /** LIVE matches automatically handed over to the results/payout queue. */
  movedToReview: SweptMatch[];
}

/**
 * Advance every due match to its correct lifecycle state.
 *
 * 1. matchTime <= now → LIVE (from any pre-match status)
 * 2. LIVE and 2h past kickoff → UNDER_REVIEW
 *
 * @param now   injectable clock (tests / replays)
 * @param tenantId optional tenant scope (used by the manual trigger)
 */
export async function sweepMatchStates(
  now?: Date,
  tenantId?: string,
): Promise<SweepResult> {
  let effectiveNow = now;
  if (!effectiveNow) {
    try {
      const dbResult: any = await prisma.$queryRawUnsafe('SELECT NOW() as db_now;');
      effectiveNow = new Date(dbResult[0]?.db_now ?? Date.now());
    } catch {
      effectiveNow = new Date();
    }
  }

  const tenantFilter = tenantId ? { tenantId } : {};
  // ── Step 1: kick off matches whose start time has arrived ────────────
  // Any pre-match status goes LIVE at kickoff — a match whose room was never
  // published must still start (the owner explicitly asked for this).
  const liveCandidates = await prisma.tournament.findMany({
    where: {
      ...tenantFilter,
      status: { in: [...PRE_MATCH_STATUSES] },
      matchTime: { lte: effectiveNow },
    },
    select: { id: true, title: true, matchTime: true },
    orderBy: { matchTime: 'asc' },
  });

  const wentLive: SweptMatch[] = [];
  for (const candidate of liveCandidates) {
    const flipped = await prisma.tournament.updateMany({
      where: { id: candidate.id, status: { in: [...PRE_MATCH_STATUSES] } },
      data: { status: 'LIVE' },
    });
    if (flipped.count !== 1) continue;
    wentLive.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'LIVE',
    });

  }

  // ── Step 2: LONG-FINISHED live matches → UNDER_REVIEW ───────────────
  // The player app stops listing a match 3h after kickoff; this status flip
  // keeps the admin history honest ("match ended, results/payout pending")
  // instead of showing yesterday's match as "Live In-Progress" forever.
  const reviewCandidates = await prisma.tournament.findMany({
    where: {
      ...tenantFilter,
      status: 'LIVE',
      matchTime: { lte: new Date(effectiveNow.getTime() - LIVE_TO_REVIEW_MS) },
    },
    select: { id: true, title: true, matchTime: true },
    orderBy: { matchTime: 'asc' },
  });

  const movedToReview: SweptMatch[] = [];
  for (const candidate of reviewCandidates) {
    const flipped = await prisma.tournament.updateMany({
      where: { id: candidate.id, status: 'LIVE' },
      data: { status: 'UNDER_REVIEW' },
    });
    if (flipped.count !== 1) continue;
    movedToReview.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'UNDER_REVIEW',
    });
  }

  return {
    ranAt: effectiveNow.toISOString(),
    wentLive,
    movedToReview,
  };
}

/**
 * 🎮 MANUAL KICKOFF — the organiser presses "Go LIVE" on the spot.
 *
 * Why this exists: the sweep only flips a match at `matchTime`, and a LIVE
 * match auto-demotes to UNDER_REVIEW 2h after kickoff. In a real tournament the
 * lobby often starts late (or a match is replayed), so the spectator needs to
 * say "this one is live NOW" instead of editing the database by hand.
 *
 * Behaviour:
 *   - any pre-match status  -> LIVE, and `matchTime` is pinned to now so the
 *     2h auto-review window starts counting from the real kickoff.
 *   - already LIVE          -> no-op re-announce (re-broadcasts the status so a
 *     player app that missed the event refreshes).
 *   - COMPLETED / CANCELLED -> rejected; those must never be resurrected.
 */
export interface ForceLiveResult {
  id: string;
  matchNumber: number | null;
  title: string;
  status: string;
  matchTime: Date;
  /** false when the match was already LIVE (idempotent re-announce). */
  changed: boolean;
}

/** 404 when the match is gone, 409 when its state forbids a kickoff. */
export class MatchNotStartableError extends ApiError {
  constructor(message: string, statusCode: 404 | 409 = 409) {
    super(statusCode, message);
    this.name = 'MatchNotStartableError';
  }
}

/** Typed as the Prisma enum so the conditional updateMany below stays type-safe. */
const STARTABLE_STATUSES: TournamentStatus[] = [...PRE_MATCH_STATUSES, 'LIVE'];

export async function forceMatchLive(
  tournamentId: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<ForceLiveResult> {
  const match = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
    select: { id: true, matchNumber: true, title: true, status: true, matchTime: true },
  });
  if (!match) throw new MatchNotStartableError('Match not found', 404);

  if (match.status === 'LIVE') {
    // Idempotent: re-announce so late-joining clients catch up.
    realtimeService.broadcast('MATCH_STATUS_CHANGED', { tournamentId: match.id, status: 'LIVE' });
    return {
      id: match.id,
      matchNumber: match.matchNumber,
      title: match.title,
      status: 'LIVE',
      matchTime: match.matchTime,
      changed: false,
    };
  }

  if (!STARTABLE_STATUSES.includes(match.status)) {
    throw new MatchNotStartableError(
      `A ${match.status.replace('_', ' ').toLowerCase()} match cannot be started. ` +
        'Only matches that have not finished yet can go LIVE.',
    );
  }

  // Conditional update keeps this safe against a concurrent sweep flipping it first.
  const flipped = await prisma.tournament.updateMany({
    where: { id: match.id, status: { in: STARTABLE_STATUSES } },
    data: { status: 'LIVE', matchTime: now },
  });
  if (flipped.count !== 1) {
    throw new MatchNotStartableError('Match state changed while starting it — refresh and retry.');
  }

  realtimeService.broadcast('MATCH_STATUS_CHANGED', { tournamentId: match.id, status: 'LIVE' });

  return {
    id: match.id,
    matchNumber: match.matchNumber,
    title: match.title,
    status: 'LIVE',
    matchTime: now,
    changed: true,
  };
}

// ─── BACKGROUND SCHEDULER ────────────────────────────────────────────────

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Start the in-process sweep loop (default: every 60 seconds).
 * Runs once shortly after boot so a restarted backend immediately repairs
 * any lifecycle state that should have changed while it was down.
 */
export function startMatchSweepScheduler(intervalMs = 60_000): void {
  if (sweepTimer) return;

  const run = async (): Promise<void> => {
    try {
      const result = await sweepMatchStates();
      if (result.wentLive.length > 0 || result.movedToReview.length > 0) {
        console.log(
          `[sweep] went live ${result.wentLive.length}, moved to review ${result.movedToReview.length}`,
        );
      }
    } catch (err) {
      console.error('[sweep] match state sweep failed:', (err as Error).message);
    }
  };

  const bootTimer = setTimeout(() => void run(), 10_000);
  bootTimer.unref();

  sweepTimer = setInterval(() => void run(), intervalMs);
  sweepTimer.unref();
  console.log(`🕒 Match state sweep scheduler running every ${Math.round(intervalMs / 1000)}s`);
}

/** Stop the sweep loop (graceful shutdown / tests). */
export function stopMatchSweepScheduler(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
