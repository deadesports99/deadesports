export type Theme = 'dark' | 'light';
export type AuthStep = 'LOGIN' | 'OTP' | 'APP';
export type NavTab = 'tournaments' | 'matches' | 'wallet' | 'settings' | 'profile';
export type FilterCategory = 'Upcoming' | 'Solo' | 'Duo' | 'Squad' | 'Clash Squad (CS)';
export type WalletMode = 'add' | 'withdraw';
export type TxFilter = 'All' | 'Deposits' | 'Winnings' | 'Withdrawals' | 'Entries';
export type AuthProvider = 'google' | 'phone';

export interface UserProfile {
  name: string;
  identifier: string;
  provider: AuthProvider;
}

export interface TournamentMatch {
  id: string;
  title: string;
  matchNumber?: number | null;
  /** Raw ISO kickoff, used by the live "MATCH STARTS IN" countdown. */
  kickoffIso?: string;
  /** True when the match status is LIVE — the card then shows "LIVE NOW". */
  isLive?: boolean;
  /**
   * Kickoff has passed but the organiser has not pressed "Go live" yet
   * (backend status STARTING_SOON). The card shows "starting shortly — please
   * wait" instead of a frozen countdown.
   */
  awaitingStart?: boolean;
  map: 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine';
  category: Exclude<FilterCategory, 'Upcoming'>;
  modeBadge: string;
  /** Short mode label for the card chip — "SOLO" / "DUO" / "SQUAD". */
  modeChip?: string;
  time: string;
  perKill: number;
  entryFee: number;
  filledSlots: number;
  totalSlots: number;
}

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  isCredit: boolean;
  category: 'Deposits' | 'Winnings' | 'Withdrawals' | 'Entries';
  badgeText: string;
  badgeTone: 'slate' | 'emerald' | 'cyan' | 'amber';
  time: string;
  reference: string;
  closingBalance?: number;
  dateGroup?: string;
  channel?: 'freefire_win' | 'freefire_entry' | 'phonepe' | 'paytm' | 'gpay' | 'bank';
  matchName?: string;
  matchMode?: 'Solo' | 'Duo' | 'Squad' | 'CS 4v4';
  map?: string;
  playerUid?: string;
  gameResult?: string;
  payoutMethod?: string;
  status?: 'Success' | 'Processing' | 'Failed';
}

export interface EsportsGameTitle {
  name: string;
  tag: string;
  active: boolean;
  icon?: string;
}

// ── My Matches (own match history) ────────────────────────────────────────

export type MyMatchBucket = 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled';
export type MyMatchPhase = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface MyMatchResult {
  rank: number | null;
  kills: number;
  prizeWon: number;
  isApproved: boolean;
  isDisqualified: boolean;
  disqualifyReason: string | null;
}

/** One seat the player has booked, with whatever the match produced. */
export interface MyMatch {
  id: string;
  title: string;
  matchNumber: number | null;
  kickoffIso: string;
  status: string;
  phase: MyMatchPhase;
  map: 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine';
  category: Exclude<FilterCategory, 'Upcoming'>;
  modeChip: string;
  entryFee: number;
  perKill: number;
  slotNumber: number;
  joinedIso: string;
  inGameNameSnapshot: string | null;
  inGameUidSnapshot: string | null;
  isBannedFromMatch: boolean;
  banReason: string | null;
  roomUnlocked: boolean;
  room: { roomId: string | null; roomPassword: string | null } | null;
  result: MyMatchResult | null;
  refunded: boolean;
  refundAmount: number;
  net: number | null;
}

export interface MyMatchesSummary {
  matchesJoined: number;
  matchesPlayed: number;
  booyahs: number;
  totalKills: number;
  totalWinnings: number;
  bestRank: number | null;
  upcomingCount: number;
  liveCount: number;
  completedCount: number;
  cancelledCount: number;
}
