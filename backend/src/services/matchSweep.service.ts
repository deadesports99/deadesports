import { prisma } from '../config/prisma.js';
import { pushToTournamentParticipants } from './fcm.service.js';
import { realtimeService } from './realtime.service.js';

/**
 * 🕒 MATCH STATE-MACHINE SWEEP
 *
 * The tournament lifecycle is time driven:
 *
 *   UPCOMING / OPEN / SLOTS_FULL ──(T-15min)──► ROOM_REVEALED ──(kickoff)──► LIVE
 *
 * Staff can move the machine manually (publishing a room jumps straight to
 * ROOM_REVEALED). This sweep is the automatic safety net: it is safe to run
 * every minute and near-instantly after a backend restart, because every
 * transition is a conditional `updateMany` (PENDING-style guard) — two
 * concurrent sweeps can never double-fire a push notification.
 */

/** Room credentials unlock exactly 15 minutes before matchTime. */
export const ROOM_REVEAL_WINDOW_MS = 15 * 60 * 1000;

/** Statuses that may still be auto-revealed by the sweep. */
const REVEALABLE_STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL'] as const;

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
  const revealCutoff = new Date(effectiveNow.getTime() + ROOM_REVEAL_WINDOW_MS);

  // ── Step 1: reveal rooms for matches that start within 15 minutes ────
  const revealCandidates = await prisma.tournament.findMany({
    where: {
      ...tenantFilter,
      status: { in: [...REVEALABLE_STATUSES] },
      matchTime: { lte: revealCutoff },
    },
    select: { id: true, title: true, matchTime: true, roomId: true },
    orderBy: { matchTime: 'asc' },
  });

  const roomRevealed: SweptMatch[] = [];
  for (const candidate of revealCandidates) {
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

    void pushToTournamentParticipants(candidate.id, {
      type: 'ROOM_REVEALED',
      tournamentId: candidate.id,
      title: '🏟 Room Reveal Window Open!',
      body: candidate.roomId
        ? `Custom room is out for "${candidate.title}" — open the app for room ID & password.`
        : `"${candidate.title}" starts in 15 minutes. Room ID drops any moment.`,
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

  return {
    ranAt: effectiveNow.toISOString(),
    revealWindowMinutes: ROOM_REVEAL_WINDOW_MS / 60000,
    roomRevealed,
    wentLive,
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
      if (result.roomRevealed.length > 0 || result.wentLive.length > 0) {
        console.log(
          `[sweep] revealed ${result.roomRevealed.length}, went live ${result.wentLive.length}`,
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
