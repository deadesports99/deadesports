import type { ApiTournament } from './api';
import type { TournamentMatch } from '../types';

/**
 * Backend tournament → the shape the demo cards already render.
 * Nothing here invents data: amounts come from the API strings, seats from the
 * live count, and the map/mode labels from the real enums.
 */

const MAP_LABEL: Record<ApiTournament['mapType'], TournamentMatch['map']> = {
  BERMUDA: 'Bermuda',
  PURGATORY: 'Purgatory',
  KALAHARI: 'Kalahari',
  ALPINE: 'Alpine',
  NEXTERRA: 'Bermuda',
};

const MODE_LABEL: Record<ApiTournament['matchType'], string> = {
  SOLO: 'Solo',
  DUO: 'Duo',
  SQUAD: 'Squad',
};

const CATEGORY: Record<ApiTournament['matchType'], TournamentMatch['category']> = {
  SOLO: 'Solo',
  DUO: 'Duo',
  SQUAD: 'Squad',
};

/** "Bermuda Solo #12" → the card title the demo shows. */
export function toMatch(t: ApiTournament): TournamentMatch {
  return {
    id: t.id,
    title: t.title,
    map: MAP_LABEL[t.mapType] ?? 'Bermuda',
    category: CATEGORY[t.matchType] ?? 'Solo',
    modeBadge: `${MODE_LABEL[t.matchType]} • ${MAP_LABEL[t.mapType]}`,
    time: formatMatchTime(t.matchTime),
    prizePool: Number(t.prizePool),
    perKill: t.perKillPrize ? Number(t.perKillPrize) : 0,
    entryFee: Number(t.entryFee),
    filledSlots: t.slotsBooked,
    totalSlots: t.totalSlots,
  };
}

/** IST wall-clock, the way the rest of the app shows times. */
export function formatMatchTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const clock = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  if (sameDay) return `Today, ${clock}`;
  if (isTomorrow) return `Tomorrow, ${clock}`;
  const day = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  return `${day}, ${clock}`;
}

/** Feed rule: joinable or live, and not hidden by the admin's visibility window. */
export function isFeedMatch(t: ApiTournament): boolean {
  const feedStatuses = ['OPEN', 'UPCOMING', 'SLOTS_FULL', 'ROOM_REVEALED', 'LIVE'];
  if (!feedStatuses.includes(t.status)) return false;
  if (t.isListedNow === false) return false;
  if (t.mySlot) return true;
  if (t.status === 'LIVE') return false; // live matches are not joinable
  return true;
}

/** True when the entry window is closed (1 minute before kickoff, same as the API). */
export function isJoinClosed(t: ApiTournament, nowMs = Date.now()): boolean {
  const kickoff = new Date(t.matchTime).getTime();
  if (Number.isNaN(kickoff)) return true;
  return kickoff - nowMs <= 60_000;
}
