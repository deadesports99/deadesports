import { ApiError } from '../utils/ApiError.js';

/**
 * 🔑 ADMIN-ONLY ROOM CREDENTIALS REVEAL
 *
 * The owner's rule: a player may see the custom Room ID & Password **only after
 * an admin or sub-admin publishes it**. There is no clock-based reveal any more —
 * a match can start with no room at all, and the sweep must never hand the code
 * out on its own.
 *
 *   - roomRevealedAt != null -> staff pressed "Publish" => visible immediately
 *   - roomRevealedAt == null -> nothing reaches the players, however close kickoff is
 *
 * Every service (feed, details, room endpoint) must use these helpers so the
 * rule is identical everywhere.
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

/**
 * @deprecated kept for the legacy `roomRevealMinutes` column only.
 * Nothing auto-reveals any more — credentials appear when staff publish them.
 */
export function roomRevealAt(matchTime: Date, roomRevealMinutes: number): Date {
  return new Date(matchTime.getTime() - roomRevealMinutes * MINUTE_MS);
}

/** True only after staff published the credentials. The clock never unlocks them. */
export function isRoomUnlocked(t: RoomRevealFields, _nowMs: number = Date.now()): boolean {
  return Boolean(t.roomRevealedAt);
}

/** No countdown exists any more: 0 means "already published", not "about to". */
export function secondsUntilRoomReveal(t: RoomRevealFields, nowMs: number = Date.now()): number {
  return isRoomUnlocked(t, nowMs) ? 0 : 0;
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

/** Feed/API payload metadata about the reveal state. */
export function roomRevealMeta(t: RoomRevealFields, nowMs: number = Date.now()) {
  const minutes = t.roomRevealMinutes ?? DEFAULT_ROOM_REVEAL_MINUTES;
  return {
    roomRevealMinutes: minutes,
    // No scheduled drop: the room shows up when staff publish it.
    roomRevealsAt: null,
    roomUnlocked: isRoomUnlocked(t, nowMs),
    secondsUntilRoomReveal: 0,
  };
}
