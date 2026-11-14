/**
 * Shared types for the admin console.
 *
 * The shapes mirror what the Express API actually returns (see `lib/api.ts`),
 * not the demo data the player app started with.
 */

export type Theme = 'dark' | 'light';

export type Role = 'USER' | 'ADMIN' | 'SUB_ADMIN';

/** The four permission flags stored on `User` (live, changed by the owner). */
export interface Permissions {
  canCreateMatch: boolean;
  canUpdateRoomId: boolean;
  canDistributePrize: boolean;
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
  prizePool: string;
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
    prizePool: string;
    perKillPrize: string;
    totalSlots: number;
    slotsBooked: number;
  };
  prizeRules: { '1': number; '2': number; '3': number };
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
  platformCut: number;
  commissionRate: number;
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
  allowEmailAuth: boolean;
}

/** Everything the "Aaj ka kaam" strip needs, loaded in parallel. */
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
