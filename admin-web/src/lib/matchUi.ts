import type {
  AdminTournament,
  MatchRoomCredentials,
  MatchRoster,
  RosterParticipant,
  TournamentStatus,
} from '../types';
import { formatINR, formatIST, humanize, relativeToNow } from './format';

/**
 * Match-labelling + money helpers shared by the four Phase 4 screens.
 * Everything here mirrors a backend rule; never invent a second formula.
 */

export const UPCOMING_STATUSES: TournamentStatus[] = [
  'DRAFT',
  'UPCOMING',
  'OPEN',
  'SLOTS_FULL',
  'ROOM_REVEALED',
];

/** Matches the roster payout engine accepts (`PAYOUT_STATUSES`). */
export const PAYOUT_STATUSES: TournamentStatus[] = [
  'OPEN',
  'SLOTS_FULL',
  'ROOM_REVEALED',
  'LIVE',
  'UNDER_REVIEW',
];

/** Matches the cancel + refund engine accepts (`CANCELLABLE_STATUSES`). */
export const CANCELLABLE_STATUSES: TournamentStatus[] = [
  'DRAFT',
  'UPCOMING',
  'OPEN',
  'SLOTS_FULL',
  'ROOM_REVEALED',
];

export type MatchTab = 'LIVE' | 'UPCOMING' | 'HISTORY';

export function tabOf(status: TournamentStatus): MatchTab {
  if (status === 'LIVE') return 'LIVE';
  if (UPCOMING_STATUSES.includes(status)) return 'UPCOMING';
  return 'HISTORY';
}

export function isPayoutAllowed(status: TournamentStatus): boolean {
  return PAYOUT_STATUSES.includes(status);
}

export function isCancellable(status: TournamentStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** `#12 Bermuda • Squad` — the canonical match identity. */
export function matchHeadline(match: Pick<AdminTournament, 'matchNumber' | 'title' | 'mapType' | 'matchType'>): string {
  if (match.matchNumber != null) {
    return `#${match.matchNumber} ${humanize(match.mapType)} • ${humanize(match.matchType)}`;
  }
  return match.title || 'Match';
}

export function matchShort(match: Pick<AdminTournament, 'matchNumber' | 'mapType' | 'matchType'>): string {
  const base = `${humanize(match.mapType)} • ${humanize(match.matchType)}`;
  return match.matchNumber != null ? `#${match.matchNumber} ${base}` : base;
}

export function entryOf(match: Pick<AdminTournament, 'entryFee'>): number {
  const value = Number(match.entryFee);
  return Number.isFinite(value) ? value : 0;
}

export function prizePoolOf(match: Pick<AdminTournament, 'prizePool'>): number {
  const value = Number(match.prizePool);
  return Number.isFinite(value) ? value : 0;
}

/** `👁 Listed` / `Hidden — lists 05 Nov, 06:00 PM IST`. */
export function visibilityLabel(match: AdminTournament): string {
  if (match.isListedNow === true || match.isListedNow === undefined) {
    return match.visibilityHours ? `Listed (window ${match.visibilityHours}h)` : 'Listed always';
  }
  if (match.visibleFrom) return `Hidden — lists ${formatIST(match.visibleFrom)}`;
  return 'Hidden from players';
}

export function visibilityShort(match: AdminTournament): string {
  return match.isListedNow === false ? 'Hidden' : 'Listed';
}

/** Room state in one honest line (publishing IS the reveal in the backend). */
export function roomStateLabel(match: AdminTournament): string {
  if (match.hasRoomCredentials === false) return 'Room not published';
  if (match.hasRoomCredentials && match.roomUnlocked) return 'Room published — players can see it';
  if (match.hasRoomCredentials) return 'Room set — not revealed yet';
  return 'Room not published';
}

export type RoomTone = 'missing' | 'hidden' | 'live';

export function roomTone(match: AdminTournament): RoomTone {
  if (match.hasRoomCredentials && match.roomUnlocked) return 'live';
  if (match.hasRoomCredentials) return 'hidden';
  return 'missing';
}

/** `starts in 2h 15m` for upcoming, `started 12m ago` for past kickoffs. */
export function matchTiming(match: Pick<AdminTournament, 'matchTime'>): string {
  return relativeToNow(match.matchTime);
}

/** Rank prize share of the pool — single source of truth (backend mirror). */
export const DEFAULT_PRIZE_RULES: MatchRoster['prizeRules'] = { '1': 0.5, '2': 0.3, '3': 0.2 };

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Same maths as `computePrize` in matchRoster.service.ts. */
export function computePrize(
  pool: number,
  perKill: number,
  rank: number | null,
  kills: number,
  rules: MatchRoster['prizeRules'] = DEFAULT_PRIZE_RULES
): number {
  const share = rank ? Number(rules[String(rank) as '1' | '2' | '3'] ?? 0) : 0;
  const rankPrize = round2(share * pool);
  const killPrize = round2(Math.max(0, Math.round(kills)) * perKill);
  return round2(rankPrize + killPrize);
}

/** One-line player identity for tables (`Slot 4 • IGN • P-XXXX`). */
export function participantLabel(participant: RosterParticipant): string {
  const ign = participant.inGameName || participant.name || participant.phoneNumber;
  return `Slot ${participant.slotNumber} • ${ign}`;
}

export function displayName(participant: RosterParticipant): string {
  return participant.inGameName || participant.name || participant.playerCode || participant.phoneNumber;
}

/** Staff-facing WhatsApp share text for a published room. */
export function roomShareText(match: {
  title: string;
  matchTime: string;
  room?: MatchRoomCredentials | null;
}): string {
  const room = match.room;
  const lines = [
    `🏟 ${match.title} — ${formatIST(match.matchTime)}`,
    room ? `Room ID: ${room.roomId}` : 'Room ID: (open the console)',
    room ? `Password: ${room.roomPassword}` : 'Password: (open the console)',
    'Join the custom room before kickoff.',
  ];
  return lines.join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** `2 seats` / `48 seats` — compact seat text for cards. */
export function seatsLabel(match: Pick<AdminTournament, 'slotsBooked' | 'totalSlots'>): string {
  return `${match.slotsBooked}/${match.totalSlots} seats`;
}

/** Money summary used inside confirm dialogs. */
export function money(value: number): string {
  return formatINR(value, value % 1 === 0 ? 0 : 2);
}
