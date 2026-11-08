export type Theme = 'dark' | 'light';
export type AuthStep = 'LOGIN' | 'OTP' | 'APP';
export type NavTab = 'tournaments' | 'wallet' | 'settings' | 'profile';
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
  map: 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine';
  category: Exclude<FilterCategory, 'Upcoming'>;
  modeBadge: string;
  time: string;
  prizePool: number;
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
