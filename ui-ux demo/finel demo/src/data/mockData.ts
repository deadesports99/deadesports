import { FilterCategory, TournamentMatch, TransactionItem, TxFilter, EsportsGameTitle } from '../types';

export const HERO_MATCH: TournamentMatch = {
  id: 'ff-hero-104',
  title: 'BERMUDA GRAND CUP #104',
  map: 'Bermuda',
  category: 'Squad',
  modeBadge: 'SQUAD GRAND FINALE',
  time: 'Starts in 01:24:10',
  prizePool: 5000,
  perKill: 25,
  entryFee: 50,
  filledSlots: 46,
  totalSlots: 48,
};

export const INITIAL_MATCHES: TournamentMatch[] = [
  {
    id: 'ff-m1',
    title: 'Bermuda Pro Scrims #42',
    map: 'Bermuda',
    category: 'Squad',
    modeBadge: 'SQUAD 4v4',
    time: 'Today, 09:30 PM',
    prizePool: 1200,
    perKill: 20,
    entryFee: 30,
    filledSlots: 38,
    totalSlots: 48,
  },
  {
    id: 'ff-m2',
    title: 'Purgatory Lone Wolf Cup',
    map: 'Purgatory',
    category: 'Solo',
    modeBadge: 'SOLO',
    time: 'Today, 10:15 PM',
    prizePool: 800,
    perKill: 15,
    entryFee: 20,
    filledSlots: 44,
    totalSlots: 48,
  },
  {
    id: 'ff-m3',
    title: 'Clash Squad Headshot Only',
    map: 'Kalahari',
    category: 'Clash Squad (CS)',
    modeBadge: 'CS 4v4 CUSTOM',
    time: 'Today, 11:00 PM',
    prizePool: 600,
    perKill: 0,
    entryFee: 50,
    filledSlots: 6,
    totalSlots: 8,
  },
  {
    id: 'ff-m4',
    title: 'Bermuda Duo Rush Series',
    map: 'Bermuda',
    category: 'Duo',
    modeBadge: 'DUO 2v2',
    time: 'Tomorrow, 06:00 PM',
    prizePool: 1000,
    perKill: 18,
    entryFee: 25,
    filledSlots: 29,
    totalSlots: 48,
  },
];

export const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-101',
    title: 'Booyah 1st Place: Purgatory Cup #38',
    amount: 350,
    isCredit: true,
    category: 'Winnings',
    badgeText: 'Winnings Won',
    badgeTone: 'emerald',
    time: 'Yesterday, 10:20 PM',
    reference: 'WIN-9920418',
  },
  {
    id: 'tx-102',
    title: 'UPI Deposit via PhonePe',
    amount: 200,
    isCredit: true,
    category: 'Deposits',
    badgeText: 'Deposit',
    badgeTone: 'cyan',
    time: 'Yesterday, 06:12 PM',
    reference: 'UTR-431900821412',
  },
  {
    id: 'tx-103',
    title: 'UPI Withdrawal to 9876543210@paytm',
    amount: 250,
    isCredit: false,
    category: 'Withdrawals',
    badgeText: 'Transfer Success',
    badgeTone: 'emerald',
    time: '01 Nov, 04:05 PM',
    reference: 'UTR-431788510924',
  },
];

export const FILTERS: FilterCategory[] = [
  'All Matches',
  'Solo',
  'Duo',
  'Squad',
  'Clash Squad (CS)',
];

export const QUICK_ADD_AMOUNTS = [50, 100, 200, 500];

export const TX_FILTERS: TxFilter[] = [
  'All',
  'Deposits',
  'Winnings',
  'Withdrawals',
  'Entries',
];

export const ESPORTS_GAMES: EsportsGameTitle[] = [
  {
    name: 'FREE FIRE',
    tag: 'LIVE',
    active: true,
    icon: '/assets/logos/free_fire_app_icon_512.png',
  },
  {
    name: 'BGMI',
    tag: 'SOON',
    active: false,
    icon: '/assets/games/bgmi/icon.png',
  },
  {
    name: 'COD MOBILE',
    tag: 'SOON',
    active: false,
  },
  {
    name: 'VALORANT M',
    tag: 'LOCKED',
    active: false,
  },
];
