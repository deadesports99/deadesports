import type { Role } from '../generated/prisma/client.js';

/**
 * Permission keys available to SUB_ADMIN (Staff) members.
 * ADMIN (Owner) implicitly holds all of them.
 */
export type PermissionKey =
  | 'canCreateMatch'
  | 'canUpdateRoomId'
  | 'canDistributePrize'
  | 'canManageWallet';

export const PERMISSION_KEYS: readonly PermissionKey[] = [
  'canCreateMatch',
  'canUpdateRoomId',
  'canDistributePrize',
  'canManageWallet',
];

/** Shape of the JWT payload issued at login/register. */
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: Role;
}

/** Authenticated user attached to `req.user` by the authenticate middleware. */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
  // Fresh permission flags fetched from the DB (only meaningful for SUB_ADMIN).
  canCreateMatch: boolean;
  canUpdateRoomId: boolean;
  canDistributePrize: boolean;
  canManageWallet: boolean;
}

export type PermissionsInput = Partial<Record<PermissionKey, boolean>>;