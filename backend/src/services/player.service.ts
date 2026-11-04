import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeUser } from './auth.service.js';

/**
 * Player career statistics — powers the Profile tab in the Player app.
 * Every number is derived from real rows (slots + verified match results),
 * nothing is stored twice, so it can never drift.
 */
export interface PlayerStats {
  matchesJoined: number;
  matchesPlayed: number;
  booyahs: number;
  totalKills: number;
  totalWinnings: number;
  bestRank: number | null;
}

export async function getPlayerStats(
  userId: string,
  tenantId: string,
): Promise<PlayerStats> {
  const player = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true },
  });
  if (!player) throw ApiError.notFound('User not found');

  const [matchesJoined, aggregate, booyahs, bestRankRow] = await Promise.all([
    prisma.tournamentSlot.count({ where: { userId } }),
    prisma.matchResult.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { verifiedKills: true, prizeWon: true },
    }),
    prisma.matchResult.count({ where: { userId, rank: 1, isDisqualified: false } }),
    prisma.matchResult.findFirst({
      where: { userId, rank: { not: null }, isDisqualified: false },
      orderBy: { rank: 'asc' },
      select: { rank: true },
    }),
  ]);

  return {
    matchesJoined,
    matchesPlayed: aggregate._count._all,
    booyahs,
    totalKills: aggregate._sum.verifiedKills ?? 0,
    totalWinnings: Number(aggregate._sum.prizeWon ?? 0),
    bestRank: bestRankRow?.rank ?? null,
  };
}

export interface UpdateGameProfileInput {
  inGameName: string;
  inGameUid: string;
}

export async function updateGameProfile(
  userId: string,
  tenantId: string,
  input: UpdateGameProfileInput,
) {
  const trimmedName = input.inGameName.trim();
  const trimmedUid = input.inGameUid.trim();

  // Ensure this UID is not taken by another user in the same tenant
  const conflict = await prisma.user.findFirst({
    where: {
      tenantId,
      inGameUid: trimmedUid,
      id: { not: userId },
    },
  });
  if (conflict) {
    throw ApiError.conflict('This Free Fire UID is already registered by another player');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      inGameName: trimmedName,
      inGameUid: trimmedUid,
    },
  });

  return sanitizeUser(updated);
}
