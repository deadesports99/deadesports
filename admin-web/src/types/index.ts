/**
 * Shared types for the admin console.
 *
 * The shapes mirror what the Express API actually returns (see `lib/api.ts`),
 * not the demo data the player app started with.
 */

export type Theme = 'dark' | 'light';

export type Role = 'USER' | 'ADMIN' | 'SUB_ADMIN';

/** One flag per admin-console SECTION (live, changed by the owner). */
export interface Permissions {
  /** Create Match — new match, clone, visibility window. */
  canCreateMatch: boolean;
  /** Manage Matches — board, kills, room, go live, submit. */
  canManageMatch: boolean;
  /** Publish room — Room ID / password + reveal timing. */
  canUpdateRoomId: boolean;
  /** Final Payout desk — see submitted matches and money totals. */
  canViewPayout: boolean;
  /** Release REAL money — prizes, seat refunds. */
  canDistributePrize: boolean;
  /** Wallet — deposits, withdrawals, online payments. */
  canManageWallet: boolean;
}

export type PermissionKey = keyof Permissions;

/** `GET /api/v1/auth/me` → sanitized user. */
export interface AdminUser {
  id: string;
  tenantId: string;
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
  inGameName?: string | null;
  inGameUid?: string | null;
  role: Role;
  permissions: Permissions;
  adminId?: string | null;
  depositBalance?: string | number;
  winningBalance?: string | number;
  isBanned?: boolean;
  playerCode?: string | null;
  createdAt?: string;
}

export type TournamentStatus =
  | 'DRAFT'
  | 'UPCOMING'
  | 'OPEN'
  | 'SLOTS_FULL'
  | 'ROOM_REVEALED'
  | 'STARTING_SOON'
  | 'LIVE'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type GameMode = 'BATTLE_ROYALE' | 'CLASH_SQUAD';
export type MatchType = 'SOLO' | 'DUO' | 'SQUAD';
export type MapType = 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';

export interface MatchRoomCredentials {
  roomId: string;
  roomPassword: string;
}

/** Tournament row as the staff list/detail endpoints return it. */
export interface AdminTournament {
  id: string;
  title: string;
  matchNumber: number | null;
  gameMode: GameMode;
  matchType: MatchType;
  mapType: MapType;
  entryFee: string;
  perKillPrize: string | null;
  totalSlots: number;
  slotsBooked: number;
  matchTime: string;
  status: TournamentStatus;
  /** Player-feed visibility window: null/undefined = listed immediately. */
  visibilityHours?: number | null;
  visibleFrom?: string | null;
  isListedNow?: boolean | null;
  secondsUntilListed?: number;
  /** Room reveal metadata (publishing IS the reveal — no clock). */
  roomRevealMinutes?: number;
  roomRevealsAt?: string | null;
  roomRevealedAt?: string | null;
  roomUnlocked?: boolean | null;
  hasRoomCredentials?: boolean | null;
  isRoomReady?: boolean | null;
  /** Staff-only: present once credentials exist. */
  room?: MatchRoomCredentials | null;
  /** Set when the admin pressed Submit — the match moved to the Final Payout desk. */
  payoutSubmittedAt?: string | null;
  mySlotNumber?: number | null;
  createdAt?: string;
}

// ── Match roster / scorer (canonical payout flow) ───────────────────────

export type ParticipantFlagCode =
  | 'NO_FF_UID'
  | 'UID_MISMATCH'
  | 'SAME_DEVICE'
  | 'SAME_DEVICE_CROSS'
  | 'ACCOUNT_BANNED'
  | 'DISQUALIFIED';

export interface ParticipantFlag {
  code: ParticipantFlagCode;
  detail: string;
}

export interface RosterParticipant {
  slotId: string;
  slotNumber: number;
  teamId: string | null;
  userId: string;
  playerCode: string | null;
  name: string | null;
  inGameName: string | null;
  inGameUid: string | null;
  phoneNumber: string;
  joinedAt: string;
  isBanned: boolean;
  banReason: string | null;
  accountBanned: boolean;
  result: {
    rank: number | null;
    verifiedKills: number;
    prizeWon: string;
    isApproved: boolean;
    isDisqualified: boolean;
    disqualifyReason: string | null;
  } | null;
  flags: ParticipantFlag[];
}

export interface MatchRoster {
  match: {
    id: string;
    matchNumber: number | null;
    title: string;
    mapType: string;
    matchType: string;
    status: string;
    matchTime: string;
    entryFee: string;
    perKillPrize: string;
    totalSlots: number;
    slotsBooked: number;
  };
  participants: RosterParticipant[];
  summary: {
    total: number;
    flagged: number;
    noUid: number;
    banned: number;
    paid: number;
    totalEntryCollected: string;
    totalPrizePaid: string;
  };
}

export type RosterFilter = 'all' | 'flagged' | 'unpaid' | 'banned' | 'dq';

export interface PayoutAwardInput {
  userId: string;
  rank: number | null;
  kills: number;
  amount?: number;
  isDisqualified?: boolean;
  disqualifyReason?: string;
  note?: string;
}

export interface PayoutAwardsResult {
  tournamentId: string;
  status: string;
  totalPaid: number;
  playersPaid: number;
  skipped: Array<{ userId: string; reason: string }>;
  breakdown: Array<{
    userId: string;
    inGameUid: string | null;
    rank: number | null;
    verifiedKills: number;
    prizePaid: number;
    isDisqualified: boolean;
  }>;
}

// ── Lifecycle / room endpoints ──────────────────────────────────────────

export interface SweepResult {
  ranAt: string;
  /** Kickoff arrived: waiting for the organiser to press "Go live". */
  awaitingStart: Array<{ id: string; title: string; matchTime: string }>;
  /** @deprecated always empty — the clock can no longer start a match. */
  wentLive: Array<{ id: string; title: string; matchTime: string }>;
  movedToReview: Array<{ id: string; title: string; matchTime: string }>;
}

export interface RoomPublishResult {
  id: string;
  title: string;
  status: TournamentStatus;
  roomRevealedAt: string | null;
  roomUnlocked: boolean;
  hasCredentials?: boolean;
  room: MatchRoomCredentials | null;
  seatedPlayers: number;
  warning: string | null;
}

export interface RoomRevealResult {
  id: string;
  title: string;
  status: TournamentStatus;
  hasCredentials: boolean;
  roomRevealedAt: string | null;
  roomUnlocked: boolean;
  roomRevealMinutes: number;
  room: MatchRoomCredentials | null;
}

export interface CancelMatchResult {
  tournamentId: string;
  status: TournamentStatus;
  refundedPlayers: number;
  totalRefunded: number;
  /** Banned seats left unpaid on purpose (their refund switch is OFF). */
  skippedBanned?: number;
  /** Seats already refunded earlier — never paid twice. */
  skippedAlreadyRefunded?: number;
}

export interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages?: number };
}

export interface AdminWithdrawal {
  id: string;
  amount: string;
  upiId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  deviceId: string | null;
  createdAt: string;
  utrNumber: string | null;
  rejectionNote: string | null;
  player: { id: string; inGameName: string | null; inGameUid: string | null; phoneNumber: string };
}

export interface AdminDeposit {
  id: string;
  amount: string;
  utrNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  rejectionNote?: string | null;
  player: { id: string; inGameName: string | null; inGameUid: string | null; phoneNumber: string };
}

export interface PaymentsSummary {
  collectedTodayPaise: number;
  collectedTodayRupees: number;
  collectedTotalPaise: number;
  collectedTotalRupees: number;
  capturedCount: number;
  pendingCount: number;
  failedCount: number;
  demoMode: boolean;
}

export type PaymentStatus = 'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED' | 'EXPIRED';

export interface AdminPayment {
  id: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: string;
  capturedAt: string | null;
  player: {
    id: string;
    name: string | null;
    inGameName: string | null;
    inGameUid: string | null;
    phoneNumber: string;
  };
}

export interface AdminPaymentsResult {
  payments: AdminPayment[];
  summary: PaymentsSummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Daily settlement (owner only) ───────────────────────────────────────

export interface SettlementSummary {
  date: string;
  totalDeposits: number;
  depositCount: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  totalMatchRevenue: number;
  matchCount: number;
  totalPrizesPaid: number;
  prizeCount: number;
  netOrganizerProfit: number;
}

export interface SettlementTransaction {
  id: string;
  createdAt: string;
  category: string;
  type: 'CREDIT' | 'DEBIT';
  balanceType: string;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  notes: string | null;
  player: {
    id: string;
    name: string | null;
    inGameName: string | null;
    phoneNumber: string;
  };
}

export interface DailySettlement {
  summary: SettlementSummary;
  transactions: SettlementTransaction[];
}

// ── Players / anti-cheat (owner only) ───────────────────────────────────

export interface AdminPlayerRow {
  id: string;
  playerCode: string | null;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  inGameName: string | null;
  inGameUid: string | null;
  depositBalance: string;
  winningBalance: string;
  isBanned: boolean;
  matchesJoined: number;
  createdAt: string;
}

export interface AdminPlayersResult {
  players: AdminPlayerRow[];
  total: number;
}

export interface PlayerHistoryRow {
  tournamentId: string;
  matchNumber: number | null;
  mapType: string;
  matchType: string;
  status: string;
  matchTime: string;
  slotNumber: number;
  joinedAt: string;
  inGameNameAtJoin: string | null;
  inGameUidAtJoin: string | null;
  rank: number | null;
  kills: number;
  prizeWon: string;
  isPaid: boolean;
  isDisqualified: boolean;
  disqualifyReason: string | null;
  bannedFromMatch: boolean;
  sharedDeviceInMatch: boolean;
}

export interface PlayerDetail {
  player: AdminPlayerRow & {
    deviceId: string | null;
    accountAgeDays: number;
    totalDeposited: string;
    totalWithdrawn: string;
    totalWinnings: string;
    totalSpentOnEntries: string;
  };
  history: {
    matches: PlayerHistoryRow[];
    summary: {
      totalMatches: number;
      completedMatches: number;
      totalKills: number;
      totalWon: string;
      booyahs: number;
      disqualifications: number;
      matchBans: number;
      sharedDeviceMatches: number;
      avgKills: number;
      winRatePct: number;
    };
  };
  linkedAccounts: Array<{
    userId: string;
    playerCode: string | null;
    inGameName: string | null;
    isBanned: boolean;
    sharedMatches: number;
  }>;
}

export interface SuspicionSignal {
  code: string;
  label: string;
  detail: string;
  weight: number;
}

export interface SuspiciousPlayer {
  userId: string;
  playerCode: string | null;
  inGameName: string | null;
  name: string | null;
  phoneNumber: string;
  inGameUid: string | null;
  deviceId: string | null;
  isBanned: boolean;
  score: number;
  signals: SuspicionSignal[];
  stats: {
    matchesJoined: number;
    completedMatches: number;
    totalWinnings: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netOut: number;
    winRatePct: number;
    avgKills: number;
    recentAvgKills: number;
    earlierAvgKills: number;
    accountsOnDevice: number;
  };
}

export interface DeviceGroup {
  deviceId: string;
  accountCount: number;
  collidedMatchCount: number;
  totalWinnings: number;
  netOut: number;
  bannedCount: number;
  accounts: Array<{
    userId: string;
    playerCode: string | null;
    inGameName: string | null;
    isBanned: boolean;
  }>;
}

export interface DeviceGroupDetail {
  deviceId: string;
  accounts: Array<{
    userId: string;
    playerCode: string | null;
    inGameName: string | null;
    name: string | null;
    phoneNumber: string;
    inGameUid: string | null;
    isBanned: boolean;
    matchesJoined: number;
    collidedMatches: number;
    totalWinnings: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netOut: number;
    createdAt: string;
    lastPlayedAt: string | null;
  }>;
  sharedMatches: Array<{
    tournamentId: string;
    matchNumber: number | null;
    mapType: string;
    matchType: string;
    status: string;
    accountCodes: string[];
  }>;
  totals: {
    accountCount: number;
    bannedCount: number;
    collidedMatchCount: number;
    totalWinnings: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netOut: number;
  };
}

export interface WatchedDevice {
  id: string;
  deviceId: string;
  note: string | null;
  isActive: boolean;
  alertCount: number;
  lastSeenAt: string | null;
  createdAt: string;
  accountCount: number;
  bannedCount: number;
  newAccountCount: number;
  collidedMatchCount: number;
  totalWinnings: number;
}

export interface WatchlistSummary {
  devices: WatchedDevice[];
  totalWatched: number;
  totalAlerts: number;
}

// ── Staff access keys (owner only) ──────────────────────────────────────

export interface AdminAccessKey {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  playerCode: string | null;
  role: string;
  keyHint: string;
  permissions: Partial<Record<PermissionKey, boolean>>;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isBanned: boolean;
}

export interface IssuedAccessKey {
  accessKey: string;
  keyId: string;
  keyHint: string;
  expiresAt: string | null;
  staff?: AdminUser;
}

// ── Runtime tenant settings (owner only) ────────────────────────────────

export interface TenantSettings {
  brandName: string;
  upiId: string;
  upiName: string;
  supportWhatsapp: string;
  minDeposit: number;
  allowPhoneAuth: boolean;
  allowGoogleAuth: boolean;
}

/** Everything the "Today's work" strip needs, loaded in parallel. */
export interface DashboardSnapshot {
  liveMatches: number;
  upcomingMatches: number;
  slotsBookedToday: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  pendingDeposits: number;
  pendingDepositsAmount: number;
  collectedToday: number;
  pendingOnline: number;
  demoPayments: boolean;
  watchlistAlerts: number;
  suspiciousPlayers: number;
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
}

// ── Manage Matches (control room) ───────────────────────────────────────

/** One row in the control room list. Counts are live, not cached. */
export interface ManageMatchRow {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  status: string;
  entryFee: number;
  perKillPrize: number;
  totalSlots: number;
  joined: number;
  banned: number;
  totalKills: number;
  finished: number;
  matchTime: string;
  roomId: string | null;
  roomPassword: string | null;
  /** Credentials saved, whether or not players can see them yet. */
  hasRoomCredentials: boolean;
  /** Saved + revealed: every seated player already has the code. */
  roomPublished: boolean;
  /** Set when the admin pressed Submit — the match moved to the Final Payout desk. */
  payoutSubmittedAt?: string | null;
}

export type PayoutFilterTab = 'pending' | 'paid' | 'all';

/** One row of the Final Payout desk (a submitted, scored match + its money). */
export interface PayoutInboxRow {
  id: string;
  matchNumber: number | null;
  title: string;
  gameMode: string;
  matchType: string;
  mapType: string;
  status: string;
  matchTime: string;
  entryFee: number;
  perKillPrize: number;
  totalSlots: number;
  joined: number;
  banned: number;
  finished: number;
  kills: number;
  /** entryFee x seats sold. */
  collected: number;
  /** Money handed back (seat + banned-seat refunds, net of reversals). */
  refunded: number;
  /** Prize money already credited by earlier partial payouts. */
  paid: number;
  /** Still owed at the current scoreboard (kills x perKill). */
  payoutDue: number;
  payoutSubmittedAt: string;
  roomId: string | null;
  roomPassword: string | null;
  hasRoomCredentials: boolean;
  roomPublished: boolean;
}

export interface PayoutInbox {
  rows: PayoutInboxRow[];
  counts: { pending: number; paid: number; all: number };
  totals: {
    collected: number;
    refunded: number;
    paid: number;
    payoutDue: number;
    /** collected - refunded - paid - payoutDue (negative = you top up). */
    balance: number;
  };
}

export interface ManageMatchListResult {
  matches: ManageMatchRow[];
  counts: {
    live: number;
    upcoming: number;
    closed: number;
    all: number;
    /** Kickoff passed, waiting for the admin to press "Start match now". */
    awaitingStart: number;
  };
}

/** One player on the live scoreboard. `kills` is the only payout input. */
export interface ManageBoardPlayer {
  userId: string;
  slotNumber: number;
  ign: string;
  freeFireUid: string;
  phoneNumber: string | null;
  kills: number;
  isEliminated: boolean;
  isBanned: boolean;
  banReason: string | null;
  /** Account-wide ban — player is logged out everywhere, not just this match. */
  accountBanned?: boolean;
  /**
   * Entry fee already returned on this seat (0 = nothing returned).
   * On a banned seat this is the coin switch state: > 0 = refund ON.
   */
  refunded?: number;
  joinedAt: string;
  paid: number;
}

export interface ManageBoard {
  match: ManageMatchRow;
  players: ManageBoardPlayer[];
  aliveCount: number;
  totalKills: number;
  maxKills: number;
  payoutPreview: number;
}

/**
 * One signed-in browser for the current admin account.
 *
 * `current` marks the browser reading the list; `active` is false for rows that
 * were signed out or ran past the absolute cap (kept for a short history).
 */
export interface AdminSessionInfo {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  active: boolean;
}

/** One row of the owner-visible admin activity trail. */
export interface AdminAuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
