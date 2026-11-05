import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { invalidateAuthCache } from '../middlewares/auth.middleware.js';

/**
 * 👥 ADMIN PLAYER MANAGEMENT
 *
 * Owner-side tools for the player base:
 *   - search by Player ID / phone / IGN / Free Fire UID
 *   - ban / unban an account (instant: the auth cache is invalidated so the
 *     banned user's existing JWT stops working on the next request)
 */

export interface AdminPlayerView {
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

export interface ListPlayersResult {
  players: AdminPlayerView[];
  total: number;
}

export async function listAdminPlayers(
  tenantId: string,
  search?: string,
  limitInput?: number,
): Promise<ListPlayersResult> {
  const limit = Math.min(100, Math.max(1, Math.round(Number(limitInput ?? 50))));
  const q = (search ?? '').trim();

  const where = {
    tenantId,
    role: 'USER' as const,
    ...(q
      ? {
          OR: [
            { playerCode: { contains: q, mode: 'insensitive' as const } },
            { phoneNumber: { contains: q } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { inGameName: { contains: q, mode: 'insensitive' as const } },
            { inGameUid: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        playerCode: true,
        phoneNumber: true,
        name: true,
        email: true,
        inGameName: true,
        inGameUid: true,
        depositBalance: true,
        winningBalance: true,
        isBanned: true,
        createdAt: true,
        _count: { select: { slots: true } },
      },
    }),
  ]);

  return {
    total,
    players: users.map((u) => ({
      id: u.id,
      playerCode: u.playerCode,
      phoneNumber: u.phoneNumber,
      name: u.name,
      email: u.email,
      inGameName: u.inGameName,
      inGameUid: u.inGameUid,
      depositBalance: String(u.depositBalance),
      winningBalance: String(u.winningBalance),
      isBanned: u.isBanned,
      matchesJoined: u._count.slots,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

export async function setPlayerBanned(
  tenantId: string,
  userId: string,
  isBanned: boolean,
): Promise<{ id: string; playerCode: string | null; isBanned: boolean }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'USER' },
    select: { id: true, isBanned: true, playerCode: true },
  });
  if (!user) throw ApiError.notFound('Player not found');
  if (user.isBanned === isBanned) {
    return { id: user.id, playerCode: user.playerCode, isBanned };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned },
    select: { id: true, playerCode: true, isBanned: true },
  });

  // Existing sessions must die immediately, not after the cache TTL.
  invalidateAuthCache(userId);
  return updated;
}
