import { ApiError } from '../utils/ApiError.js';

/**
 * 🔑 ADMIN-CONTROLLED ROOM CREDENTIALS REVEAL
 *
 * Historically the custom Room ID & Password were hard-locked until T-15 min.
 * Now the admin decides per match:
 *   - roomRevealMinutes = N  -> auto reveal N minutes before match start
 *                              (default 15, same as the old behaviour)
 *   - roomRevealedAt != null -> admin pressed "Reveal Now" (or the auto
 *                              window already fired) => visible immediately.
 *
 * Every service (feed, details, room endpoint, lifecycle sweep) must use
 * these helpers so the rule is identical everywhere.
 */

export const DEFAULT_ROOM_REVEAL_MINUTES = 15;
export const MIN_ROOM_REVEAL_MINUTES = 1;
export const MAX_ROOM_REVEAL_MINUTES = 10_080; // 7 days
export const MINUTE_MS = 60 * 1000;

export interface RoomRevealFields {
  matchTime: Date;
  roomRevealMinutes: number | null;
  roomRevealedAt: Date | null;
}

/** Validate + normalise the admin's chosen reveal window (minutes). */
export function resolveRoomRevealMinutes(raw: number | null | undefined): number {
  if (raw === null || raw === undefined) return DEFAULT_ROOM_REVEAL_MINUTES;
  const minutes = Math.round(Number(raw));
  if (!Number.isFinite(minutes) || minutes < MIN_ROOM_REVEAL_MINUTES || minutes > MAX_ROOM_REVEAL_MINUTES) {
    throw ApiError.badRequest(
      `roomRevealMinutes must be between ${MIN_ROOM_REVEAL_MINUTES} and ${MAX_ROOM_REVEAL_MINUTES}`,
    );
  }
  return minutes;
}

/** Timestamp when credentials become visible automatically. */
export function roomRevealAt(matchTime: Date, roomRevealMinutes: number): Date {
  return new Date(matchTime.getTime() - roomRevealMinutes * MINUTE_MS);
}

/** True when players may see Room ID & Password right now. */
export function isRoomUnlocked(t: RoomRevealFields, nowMs: number = Date.now()): boolean {
  if (t.roomRevealedAt) return true;
  const minutes = t.roomRevealMinutes ?? DEFAULT_ROOM_REVEAL_MINUTES;
  return nowMs >= roomRevealAt(t.matchTime, minutes).getTime();
}

/** Seconds until the auto-reveal window opens (0 when already visible). */
export function secondsUntilRoomReveal(t: RoomRevealFields, nowMs: number = Date.now()): number {
  if (isRoomUnlocked(t, nowMs)) return 0;
  const minutes = t.roomRevealMinutes ?? DEFAULT_ROOM_REVEAL_MINUTES;
  return Math.max(0, Math.ceil((roomRevealAt(t.matchTime, minutes).getTime() - nowMs) / 1000));
}

/** "15 minutes", "2 hours", "1 hour 30 minutes" — used in API messages/UI. */
export function formatRevealWindowLabel(minutes: number): string {
  const safe = Math.max(1, Math.round(minutes));
  if (safe < 60) return `${safe} minute${safe === 1 ? '' : 's'}`;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  return mins === 0 ? hourLabel : `${hourLabel} ${mins} minute${mins === 1 ? '' : 's'}`;
}

/** Feed/API payload metadata about the reveal window. */
export function roomRevealMeta(t: RoomRevealFields, nowMs: number = Date.now()) {
  const minutes = t.roomRevealMinutes ?? DEFAULT_ROOM_REVEAL_MINUTES;
  const revealAt = roomRevealAt(t.matchTime, minutes);
  const unlocked = isRoomUnlocked(t, nowMs);
  return {
    roomRevealMinutes: minutes,
    roomRevealsAt: revealAt.toISOString(),
    roomUnlocked: unlocked,
    secondsUntilRoomReveal: unlocked
      ? 0
      : Math.max(0, Math.ceil((revealAt.getTime() - nowMs) / 1000)),
  };
}
