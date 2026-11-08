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

// ─── PLAYER DETAIL + MATCH HISTORY (cheat investigation) ─────────────────

export interface PlayerMatchHistoryRow {
  tournamentId: string;
  matchNumber: number | null;
  mapType: string;
  matchType: string;
  status: string;
  matchTime: string;
  slotNumber: number;
  joinedAt: string;
  /** Join-time snapshot (what they used to enter), not the current profile. */
  inGameNameAtJoin: string | null;
  inGameUidAtJoin: string | null;
  rank: number | null;
  kills: number;
  prizeWon: string;
  isPaid: boolean;
  isDisqualified: boolean;
  disqualifyReason: string | null;
  bannedFromMatch: boolean;
  /** Two or more accounts from one device joined that same match. */
  sharedDeviceInMatch: boolean;
}

export interface PlayerAdminDetail {
  player: AdminPlayerView & {
    deviceId: string | null;
    accountAgeDays: number;
    totalDeposited: string;
    totalWithdrawn: string;
    totalWinnings: string;
    totalSpentOnEntries: string;
  };
  history: {
    matches: PlayerMatchHistoryRow[];
    summary: {
      totalMatches: number;
      completedMatches: number;
      totalKills: number;
      totalWon: string;
      booyahs: number;
      disqualifications: number;
      matchBans: number;
      sharedDeviceMatches: number;
      /** Kills per completed match — a spike here is worth a look. */
      avgKills: number;
      winRatePct: number;
    };
  };
  /** Every other account that has ever shared this player's device. */
  linkedAccounts: Array<{
    userId: string;
    playerCode: string | null;
    inGameName: string | null;
    isBanned: boolean;
    sharedMatches: number;
  }>;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * One player in full: wallet totals, every match they joined (with the identity
 * used at that moment), reward history, cheat signals and the other accounts
 * sharing their device. This is the screen an owner opens when a payout looks
 * suspicious or a player is accused of cheating.
 */
export async function getPlayerDetail(
  tenantId: string,
  userId: string,
): Promise<PlayerAdminDetail> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'USER' },
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
      deviceId: true,
      createdAt: true,
    },
  });
  if (!user) throw ApiError.notFound('Player not found');

  const slots = await prisma.tournamentSlot.findMany({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    include: {
      tournament: {
        select: {
          id: true,
          matchNumber: true,
          mapType: true,
          matchType: true,
          status: true,
          matchTime: true,
        },
      },
    },
  });

  const tournamentIds = slots.map((s) => s.tournamentId);

  const results = tournamentIds.length
    ? await prisma.matchResult.findMany({
        where: { userId, tournamentId: { in: tournamentIds } },
        select: {
          tournamentId: true,
          rank: true,
          verifiedKills: true,
          prizeWon: true,
          isApproved: true,
          isDisqualified: true,
          disqualifyReason: true,
        },
      })
    : [];
  const resultByTournament = new Map(results.map((r) => [r.tournamentId, r]));

  // Matches where another account joined from the same device.
  const devices = [
    ...new Set(slots.map((s) => s.deviceIdSnapshot).filter((d): d is string => Boolean(d))),
  ];
  const sharedDeviceByTournament = new Set<string>();
  if (devices.length > 0 && tournamentIds.length > 0) {
    const peers = await prisma.tournamentSlot.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        deviceIdSnapshot: { in: devices },
        userId: { not: userId },
      },
      select: { tournamentId: true },
    });
    for (const peer of peers) sharedDeviceByTournament.add(peer.tournamentId);
  }

  const matches: PlayerMatchHistoryRow[] = slots.map((slot) => {
    const result = resultByTournament.get(slot.tournamentId);
    return {
      tournamentId: slot.tournamentId,
      matchNumber: slot.tournament.matchNumber,
      mapType: slot.tournament.mapType,
      matchType: slot.tournament.matchType,
      status: slot.tournament.status,
      matchTime: slot.tournament.matchTime.toISOString(),
      slotNumber: slot.slotNumber,
      joinedAt: slot.joinedAt.toISOString(),
      inGameNameAtJoin: slot.inGameNameSnapshot ?? null,
      inGameUidAtJoin: slot.inGameUidSnapshot ?? null,
      rank: result?.rank ?? null,
      kills: result?.verifiedKills ?? 0,
      prizeWon: String(result?.prizeWon ?? 0),
      isPaid: result?.isApproved ?? false,
      isDisqualified: result?.isDisqualified ?? false,
      disqualifyReason: result?.disqualifyReason ?? null,
      bannedFromMatch: slot.isBanned,
      sharedDeviceInMatch: sharedDeviceByTournament.has(slot.tournamentId),
    };
  });

  // Money totals straight from the ledger (the only source of truth for balances).
  const [depositAgg, withdrawAgg, prizeAgg, entryAgg] = await Promise.all([
    prisma.walletLedger.aggregate({
      where: { userId, tenantId, category: 'ADD_MONEY', type: 'CREDIT' },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: { userId, tenantId, category: 'WITHDRAWAL', type: 'DEBIT' },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: { userId, tenantId, category: 'WINNING_PRIZE', type: 'CREDIT' },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: { userId, tenantId, category: 'JOIN_FEE', type: 'DEBIT' },
      _sum: { amount: true },
    }),
  ]);

  const completed = matches.filter(
    (m) => m.status === 'COMPLETED' || m.status === 'UNDER_REVIEW',
  );
  const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
  const totalWon = matches.reduce((sum, m) => sum + Number(m.prizeWon), 0);
  const booyahs = matches.filter((m) => m.rank === 1).length;

  // Linked accounts: other players who joined from this player's device.
  let linkedAccounts: PlayerAdminDetail['linkedAccounts'] = [];
  if (user.deviceId) {
    const peerSlots = await prisma.tournamentSlot.findMany({
      where: {
        deviceIdSnapshot: user.deviceId,
        userId: { not: userId },
      },
      select: {
        tournamentId: true,
        user: {
          select: { id: true, playerCode: true, inGameName: true, isBanned: true },
        },
      },
    });
    const map = new Map<
      string,
      {
        playerCode: string | null;
        inGameName: string | null;
        isBanned: boolean;
        matches: Set<string>;
      }
    >();
    for (const peer of peerSlots) {
      const entry = map.get(peer.user.id) ?? {
        playerCode: peer.user.playerCode,
        inGameName: peer.user.inGameName,
        isBanned: peer.user.isBanned,
        matches: new Set<string>(),
      };
      entry.matches.add(peer.tournamentId);
      map.set(peer.user.id, entry);
    }
    linkedAccounts = [...map.entries()]
      .map(([id, v]) => ({
        userId: id,
        playerCode: v.playerCode,
        inGameName: v.inGameName,
        isBanned: v.isBanned,
        sharedMatches: v.matches.size,
      }))
      .sort((a, b) => b.sharedMatches - a.sharedMatches)
      .slice(0, 20);
  }

  const accountAgeDays = Math.max(
    0,
    Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
  );

  return {
    player: {
      id: user.id,
      playerCode: user.playerCode,
      phoneNumber: user.phoneNumber,
      name: user.name,
      email: user.email,
      inGameName: user.inGameName,
      inGameUid: user.inGameUid,
      depositBalance: String(user.depositBalance),
      winningBalance: String(user.winningBalance),
      isBanned: user.isBanned,
      matchesJoined: slots.length,
      createdAt: user.createdAt.toISOString(),
      deviceId: user.deviceId,
      accountAgeDays,
      totalDeposited: String(round2(Number(depositAgg._sum.amount ?? 0))),
      totalWithdrawn: String(round2(Number(withdrawAgg._sum.amount ?? 0))),
      totalWinnings: String(round2(Number(prizeAgg._sum.amount ?? 0))),
      totalSpentOnEntries: String(round2(Number(entryAgg._sum.amount ?? 0))),
    },
    history: {
      matches,
      summary: {
        totalMatches: matches.length,
        completedMatches: completed.length,
        totalKills,
        totalWon: String(round2(totalWon)),
        booyahs,
        disqualifications: matches.filter((m) => m.isDisqualified).length,
        matchBans: matches.filter((m) => m.bannedFromMatch).length,
        sharedDeviceMatches: matches.filter((m) => m.sharedDeviceInMatch).length,
        avgKills: completed.length ? round2(totalKills / completed.length) : 0,
        winRatePct: completed.length ? round2((booyahs / completed.length) * 100) : 0,
      },
    },
    linkedAccounts,
  };
}
