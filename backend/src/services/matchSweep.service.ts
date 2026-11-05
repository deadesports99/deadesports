import { prisma } from '../config/prisma.js';
import { pushToTournamentParticipants } from './fcm.service.js';
import { realtimeService } from './realtime.service.js';
import {
  DEFAULT_ROOM_REVEAL_MINUTES,
  MAX_ROOM_REVEAL_MINUTES,
  MINUTE_MS,
  isRoomUnlocked,
  roomRevealAt,
} from './roomReveal.js';

/**
 * 🕒 MATCH STATE-MACHINE SWEEP
 *
 * The tournament lifecycle is time driven:
 *
 *   UPCOMING / OPEN / SLOTS_FULL ──(T-Nmin)──► ROOM_REVEALED ──(kickoff)──► LIVE
 *
 * N comes from the admin's per-match `roomRevealMinutes` (default 15 minutes,
 * same as the old fixed rule). Publishing a room with "Reveal Now" jumps
 * straight to ROOM_REVEALED. This sweep is the automatic safety net: it is safe
 * to run every minute and near-instantly after a backend restart, because every
 * transition is a conditional `updateMany` (PENDING-style guard) — two
 * concurrent sweeps can never double-fire a push notification.
 */

/** Default reveal window (legacy export — per-match value lives on Tournament). */
export const ROOM_REVEAL_WINDOW_MS = DEFAULT_ROOM_REVEAL_MINUTES * MINUTE_MS;

/** Statuses that may still be auto-revealed by the sweep. */
const REVEALABLE_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL'] as const;

/** How far ahead we look for matches whose admin reveal window may have opened. */
const MAX_REVEAL_LOOKAHEAD_MS = MAX_ROOM_REVEAL_MINUTES * MINUTE_MS;

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
  revealWindowMinutes: number;
  roomRevealed: SweptMatch[];
  wentLive: SweptMatch[];
  /** LIVE matches automatically handed over to the results/payout queue. */
  movedToReview: SweptMatch[];
}

/**
 * Advance every due match to its correct lifecycle state.
 *
 * 1. matchTime <= now + 15min  → ROOM_REVEALED (+FCM alert to participants)
 * 2. matchTime <= now          → LIVE
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
  // Look ahead far enough for the largest admin-configured reveal window.
  const revealCutoff = new Date(effectiveNow.getTime() + MAX_REVEAL_LOOKAHEAD_MS);

  // ── Step 1: reveal rooms whose admin-configured reveal time has arrived ──
  const revealCandidates = await prisma.tournament.findMany({
    where: {
      ...tenantFilter,
      status: { in: [...REVEALABLE_STATUSES] },
      matchTime: { lte: revealCutoff },
    },
    select: {
      id: true,
      title: true,
      matchTime: true,
      roomId: true,
      roomRevealMinutes: true,
      roomRevealedAt: true,
    },
    orderBy: { matchTime: 'asc' },
  });

  const roomRevealed: SweptMatch[] = [];
  for (const candidate of revealCandidates) {
    // Per-match admin window: skip matches whose reveal time is still ahead.
    if (!isRoomUnlocked(candidate, effectiveNow.getTime())) continue;
    const revealAt = roomRevealAt(candidate.matchTime, candidate.roomRevealMinutes);

    const flipped = await prisma.tournament.updateMany({
      where: { id: candidate.id, status: { in: [...REVEALABLE_STATUSES] } },
      data: { status: 'ROOM_REVEALED', roomRevealedAt: effectiveNow },
    });
    if (flipped.count !== 1) continue; // someone else won the race — skip the push

    roomRevealed.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'ROOM_REVEALED',
    });

    // If room credentials were saved earlier by admin, deliver them now.
    if (candidate.roomId) {
      try {
        const creds = await prisma.tournament.findUnique({
          where: { id: candidate.id },
          select: { roomId: true, roomPassword: true, roomRevealedAt: true },
        });
        if (creds?.roomId && creds.roomPassword) {
          const confirmedSlots = await prisma.tournamentSlot.findMany({
            where: { tournamentId: candidate.id },
            select: { userId: true },
          });
          if (confirmedSlots.length > 0) {
            realtimeService.sendToUsers(
              confirmedSlots.map((s) => s.userId),
              'ROOM_CREDENTIALS_REVEALED',
              {
                tournamentId: candidate.id,
                roomId: creds.roomId,
                roomPassword: creds.roomPassword,
                roomRevealedAt: creds.roomRevealedAt,
              },
            );
          }
        }
      } catch (err) {
        // A notification failure must not stop the sweep for other matches.
        console.error('[sweep] room reveal notification failed:', err);
      }
    }

    void pushToTournamentParticipants(candidate.id, {
      type: 'ROOM_REVEALED',
      tournamentId: candidate.id,
      title: '🏟 Room Reveal Window Open!',
      body: candidate.roomId
        ? `Custom room is out for "${candidate.title}" — open the app for room ID & password.`
        : `"${candidate.title}" room reveal window is open (${revealAt.toISOString()}). Room ID drops any moment.`,
    });
  }

  // ── Step 2: kick off matches whose start time has arrived ────────────
  const liveCandidates = await prisma.tournament.findMany({
    where: {
      ...tenantFilter,
      status: 'ROOM_REVEALED',
      matchTime: { lte: effectiveNow },
    },
    select: { id: true, title: true, matchTime: true },
    orderBy: { matchTime: 'asc' },
  });

  const wentLive: SweptMatch[] = [];
  for (const candidate of liveCandidates) {
    const flipped = await prisma.tournament.updateMany({
      where: { id: candidate.id, status: 'ROOM_REVEALED' },
      data: { status: 'LIVE' },
    });
    if (flipped.count !== 1) continue;
    wentLive.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'LIVE',
    });

  }

  // ── Step 3: LONG-FINISHED live matches → UNDER_REVIEW ───────────────
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
    revealWindowMinutes: ROOM_REVEAL_WINDOW_MS / 60000,
    roomRevealed,
    wentLive,
    movedToReview,
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
      if (
        result.roomRevealed.length > 0 ||
        result.wentLive.length > 0 ||
        result.movedToReview.length > 0
      ) {
        console.log(
          `[sweep] revealed ${result.roomRevealed.length}, went live ${result.wentLive.length}, ` +
            `moved to review ${result.movedToReview.length}`,
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
