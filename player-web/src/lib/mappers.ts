import type { ApiMyMatch, ApiTournament } from './api';
import type { MyMatch, MyMatchPhase, TournamentMatch } from '../types';

/**
 * How the account is shown on the Settings page.
 *
 * Google sign-ups have no phone number: the backend stores a `G…` placeholder so
 * the unique constraint holds. Printing that as `+91 G…` is not a phone number,
 * so those players see their email instead.
 */
export function identityLabel(user: {
  phoneNumber?: string | null;
  email?: string | null;
}): string {
  const digits = (user.phoneNumber ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  return user.email?.trim() || 'Google account';
}

/** Field name that matches [identityLabel] — "Mobile Number" or "Email ID". */
export function identityFieldLabel(identifier: string): 'Mobile Number' | 'Email ID' {
  return identifier.includes('@') ? 'Email ID' : 'Mobile Number';
}

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
    matchNumber: t.matchNumber ?? null,
    kickoffIso: t.matchTime,
    isLive: t.status === 'LIVE',
    awaitingStart: t.status === 'STARTING_SOON',
    map: MAP_LABEL[t.mapType] ?? 'Bermuda',
    category: CATEGORY[t.matchType] ?? 'Solo',
    modeBadge: `${MODE_LABEL[t.matchType]} • ${MAP_LABEL[t.mapType]}`,
    modeChip: (MODE_LABEL[t.matchType] ?? 'Solo').toUpperCase(),
    time: formatMatchTime(t.matchTime),
    perKill: t.perKillPrize ? Number(t.perKillPrize) : 0,
    entryFee: Number(t.entryFee),
    filledSlots: t.slotsBooked,
    totalSlots: t.totalSlots,
  };
}

/** "12 Nov, 08:00 PM" — the kickoff stamp shown under the card's chips (IST). */
export function formatKickoffStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const clock = date
    .toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
    .toUpperCase(); // "08:00 PM", matching the app's stamp
  return `${day}, ${clock}`;
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
  // STARTING_SOON stays in the feed: kickoff passed, the organiser is about to
  // start it, and the player must still see their match.
  const feedStatuses = ['OPEN', 'UPCOMING', 'SLOTS_FULL', 'ROOM_REVEALED', 'STARTING_SOON', 'LIVE'];
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

// ── My Matches ───────────────────────────────────────────────────────────

/** Backend history row → the shape the My Matches card renders. */
export function toMyMatch(item: ApiMyMatch): MyMatch {
  return {
    id: item.id,
    title: item.title,
    matchNumber: item.matchNumber ?? null,
    kickoffIso: item.matchTime,
    status: item.status,
    phase: item.phase,
    map: MAP_LABEL[item.mapType] ?? 'Bermuda',
    category: CATEGORY[item.matchType] ?? 'Solo',
    modeChip: (MODE_LABEL[item.matchType] ?? 'Solo').toUpperCase(),
    entryFee: Number(item.entryFee ?? 0),
    perKill: Number(item.perKillPrize ?? 0),
    slotNumber: item.slotNumber,
    joinedIso: item.joinedAt,
    inGameNameSnapshot: item.inGameNameSnapshot ?? null,
    inGameUidSnapshot: item.inGameUidSnapshot ?? null,
    isBannedFromMatch: item.isBannedFromMatch === true,
    banReason: item.banReason ?? null,
    roomUnlocked: item.roomUnlocked === true,
    room: item.room ?? null,
    result: item.result
      ? {
          rank: item.result.rank ?? null,
          kills: item.result.kills ?? 0,
          prizeWon: Number(item.result.prizeWon ?? 0),
          isApproved: item.result.isApproved === true,
          isDisqualified: item.result.isDisqualified === true,
          disqualifyReason: item.result.disqualifyReason ?? null,
        }
      : null,
    refunded: item.refunded === true,
    refundAmount: Number(item.refundAmount ?? 0),
    net: item.net === null || item.net === undefined ? null : Number(item.net),
  };
}

/**
 * The status pill on a history card. Deliberately a different vocabulary from
 * the lobby: here nothing is "joinable", every state is an outcome.
 */
export type MyMatchTone = 'cyan' | 'amber' | 'rose' | 'emerald' | 'gold' | 'slate';

export interface MyMatchPill {
  label: string;
  tone: MyMatchTone;
}

export function myMatchPill(match: MyMatch): MyMatchPill {
  if (match.isBannedFromMatch) return { label: 'BANNED', tone: 'rose' };
  if (match.result?.isDisqualified) return { label: 'DISQUALIFIED', tone: 'rose' };

  switch (match.phase) {
    case 'upcoming':
      if (match.status === 'STARTING_SOON') return { label: 'STARTING SOON', tone: 'amber' };
      return match.roomUnlocked && match.room
        ? { label: 'ROOM READY', tone: 'amber' }
        : { label: 'JOINED', tone: 'cyan' };
    case 'live':
      return { label: 'LIVE', tone: 'rose' };
    case 'completed':
      if (!match.result) return { label: 'RESULT PENDING', tone: 'slate' };
      if (match.result.rank === 1) return { label: 'BOOYAH', tone: 'gold' };
      if (match.result.rank != null) return { label: `RANK #${match.result.rank}`, tone: 'emerald' };
      return { label: 'PLAYED', tone: 'slate' };
    case 'cancelled':
      return match.refunded
        ? { label: 'REFUNDED', tone: 'slate' }
        : { label: 'CANCELLED', tone: 'slate' };
    default:
      return { label: match.status, tone: 'slate' };
  }
}

export type MyMatchActionKind = 'room' | 'pending' | 'none';

export interface MyMatchAction {
  label: string;
  kind: MyMatchActionKind;
}

/**
 * What the card's button does — never "Join".
 * A published room opens the code sheet; everything else (including finished
 * matches, whose rank/kills/prize already sit on the card) is read-only status.
 */
export function myMatchAction(match: MyMatch): MyMatchAction {
  if (match.isBannedFromMatch) return { label: 'Banned from this match', kind: 'pending' };
  if (match.result?.isDisqualified) return { label: 'Disqualified', kind: 'pending' };

  if (match.phase === 'upcoming' || match.phase === 'live') {
    if (match.roomUnlocked && match.room) return { label: 'View Room ID', kind: 'room' };
    if (match.status === 'STARTING_SOON') return { label: 'Please wait', kind: 'pending' };
    return match.phase === 'live'
      ? { label: 'Room awaited', kind: 'pending' }
      : { label: 'Joined — awaiting room', kind: 'pending' };
  }

  if (match.phase === 'completed') {
    return match.result
      ? { label: 'Result declared', kind: 'none' }
      : { label: 'Result awaited', kind: 'pending' };
  }

  return match.refunded
    ? { label: `Refunded ₹${match.refundAmount}`, kind: 'none' }
    : { label: 'Match cancelled', kind: 'none' };
}

/** "+₹50" / "−₹20" / "₹0" — the money outcome chip on a settled card. */
/**
 * Short "when" line under the seat: "in 2h 10m", "in 45m", "starting now",
 * "in progress", or "" when the kickoff time cannot be parsed.
 *
 * Pure — `nowMs` is injected so the rule stays testable.
 */
export function matchTiming(kickoffIso: string, phase: MyMatchPhase, nowMs: number = Date.now()): string {
  if (phase === 'live') return 'in progress';
  const startMs = Date.parse(kickoffIso);
  if (Number.isNaN(startMs)) return '';
  const deltaMs = startMs - nowMs;
  // Kickoff passed but the match is not LIVE: the organiser has not started it yet.
  if (deltaMs <= 0) return 'starting shortly';
  const minutes = Math.ceil(deltaMs / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 24 * 60) return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `in ${Math.floor(minutes / (24 * 60))}d`;
}

export function formatNet(net: number | null): string {
  if (net === null) return '—';
  if (net > 0) return `+₹${net.toLocaleString('en-IN')}`;
  if (net < 0) return `−₹${Math.abs(net).toLocaleString('en-IN')}`;
  return '₹0';
}
