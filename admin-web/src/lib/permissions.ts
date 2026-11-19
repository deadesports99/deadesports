import {
  Banknote,
  Gamepad2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { AdminUser, PermissionKey } from '../types';

/**
 * Permission model — mirrors the section flags on `User` exactly.
 *
 * ADMIN (owner) bypasses every flag server-side, so the UI does the same.
 * Staff permissions are read live from the DB on every request, which means
 * turning a toggle off hides the card/route on the next fetch without a re-login.
 */

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; hint: string }> = {
  canCreateMatch: { label: 'Create match', hint: 'New match, clone & visibility window' },
  canManageMatch: { label: 'Manage match', hint: 'Board, kills, room, go live & submit' },
  canUpdateRoomId: { label: 'Publish room', hint: 'Room ID / password + reveal timing' },
  canViewPayout: { label: 'Final payout (view)', hint: 'See submitted matches & money totals' },
  canDistributePrize: { label: 'Pay real money', hint: 'Release prizes, seat refunds & DQ' },
  canManageWallet: { label: 'Manage wallet', hint: 'Deposits, withdrawals & online payments' },
};

/** Every section, in the order the owner console lists them. */
export const PERMISSION_KEYS: PermissionKey[] = [
  'canCreateMatch',
  'canManageMatch',
  'canUpdateRoomId',
  'canViewPayout',
  'canDistributePrize',
  'canManageWallet',
];

export type Access = PermissionKey | 'owner' | 'any';

export function isOwner(user: AdminUser | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

/** `can(user, 'canManageWallet')` / `can(user, 'owner')` / `can(user, 'any')`. */
export function can(user: AdminUser | null | undefined, access: Access = 'any'): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (access === 'any') return true;
  if (access === 'owner') return false;
  return Boolean(user.permissions?.[access]);
}

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  access: Access;
  /** Screens that arrive in a later phase still show as "coming next" cards. */
  phase?: 5;
  /** Shown in the mobile bottom bar (max 4 + More). */
  mobile?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, access: 'any', mobile: true },
      { to: '/matches', label: 'Matches', icon: Gamepad2, access: 'any', mobile: true },
      { to: '/matches/create', label: 'Create Match', icon: Swords, access: 'canCreateMatch' },
      { to: '/manage', label: 'Manage Matches', shortLabel: 'Manage', icon: SlidersHorizontal, access: 'canManageMatch', mobile: true },
      { to: '/payouts', label: 'Final Payout', shortLabel: 'Payout', icon: Banknote, access: 'canViewPayout', mobile: true },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { to: '/wallet', label: 'Wallet', icon: Wallet, access: 'canManageWallet', mobile: true },
      { to: '/wallet/settlement', label: 'Settlement', icon: ShieldCheck, access: 'owner' },
    ],
  },
  {
    id: 'owner',
    label: 'Owner controls',
    items: [
      { to: '/players', label: 'Players', icon: Users, access: 'owner' },
      { to: '/staff', label: 'Staff & Access', shortLabel: 'Staff', icon: ShieldCheck, access: 'owner' },
      { to: '/settings', label: 'App Settings', shortLabel: 'Settings', icon: Settings, access: 'owner' },
    ],
  },
];

/** All nav items the signed-in user is allowed to see. */
export function allowedNav(user: AdminUser | null): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items.filter((item) => can(user, item.access)));
}

/** Route → required access. Unknown routes fall back to the dashboard. */
export const ROUTE_ACCESS: Array<{ pattern: RegExp; access: Access }> = [
  { pattern: /^\/$/, access: 'any' },
  { pattern: /^\/matches$/, access: 'any' },
  { pattern: /^\/matches\/create$/, access: 'canCreateMatch' },
  { pattern: /^\/matches\/publish$/, access: 'canUpdateRoomId' },
  { pattern: /^\/matches\/[^/]+$/, access: 'any' },
  { pattern: /^\/manage/, access: 'canManageMatch' },
  { pattern: /^\/payouts/, access: 'canViewPayout' },
  // Legacy links; both redirect to /payouts, which enforces its own access.
  { pattern: /^\/roster/, access: 'any' },
  { pattern: /^\/scorer/, access: 'any' },
  { pattern: /^\/wallet\/settlement$/, access: 'owner' },
  { pattern: /^\/wallet/, access: 'canManageWallet' },
  { pattern: /^\/players/, access: 'owner' },
  { pattern: /^\/staff/, access: 'owner' },
  { pattern: /^\/settings/, access: 'owner' },
];

export function accessForPath(pathname: string): Access {
  const match = ROUTE_ACCESS.find((entry) => entry.pattern.test(pathname));
  return match?.access ?? 'any';
}
