import type { Role } from '../generated/prisma/client.js';

/**
 * Permission keys available to SUB_ADMIN (Staff) members.
 * ADMIN (Owner) implicitly holds all of them.
 */
export type PermissionKey =
  | 'canCreateMatch'
  | 'canManageMatch'
  | 'canUpdateRoomId'
  | 'canViewPayout'
  | 'canDistributePrize'
  | 'canManageWallet';

export const PERMISSION_KEYS: readonly PermissionKey[] = [
  'canCreateMatch',
  'canManageMatch',
  'canUpdateRoomId',
  'canViewPayout',
  'canDistributePrize',
  'canManageWallet',
];

/** Shape of the JWT payload issued at login/register. */
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: Role;
  /**
   * Present only on admin-web sessions that logged in with a staff permission
   * key. The middleware re-checks this key so a revoke kills the session.
   */
  accessKeyId?: string;
  /** AdminSession row id — the per-device kill switch. */
  sid?: string;
  /** User.sessionVersion at issue time — the kill-everywhere switch. */
  sv?: number;
}

/** Authenticated user attached to `req.user` by the authenticate middleware. */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
  // Fresh permission flags fetched from the DB (only meaningful for SUB_ADMIN).
  canCreateMatch: boolean;
  canManageMatch: boolean;
  canUpdateRoomId: boolean;
  canViewPayout: boolean;
  canDistributePrize: boolean;
  canManageWallet: boolean;
}

export type PermissionsInput = Partial<Record<PermissionKey, boolean>>;