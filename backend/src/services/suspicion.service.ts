import { prisma } from '../config/prisma.js';

/**
 * 🚨 SUSPICIOUS PLAYERS
 *
 * The owner should not have to open 400 profiles to find the five that need a
 * look. This service scores every player on the signals we can actually prove
 * from the database, and returns only the ones worth investigating.
 *
 * Signals (each carries its own weight and a plain-language reason):
 *   DEVICE_FARM     3+ accounts have joined from one device
 *   DEVICE_SHARED   2 accounts from one device in the SAME match (worst case)
 *   NET_POSITIVE    withdrew more than they added, and actually won prize money
 *   HIGH_WIN_RATE   60%+ win rate over 5+ completed matches
 *   KILL_SPIKE      recent avg kills ≥ 3x their earlier average (min 3 matches each side)
 *   NO_FF_UID       joined matches without a Free Fire UID (unpayable, filler account)
 *   DQ_HISTORY      disqualified or match-banned at least once
 *
 * The score is only a sorting order. Nothing here bans anybody automatically —
 * every row is a hint for a human to open and decide on.
 */

export type SuspicionSignalCode =
  | 'DEVICE_FARM'
  | 'DEVICE_SHARED'
  | 'NET_POSITIVE'
  | 'HIGH_WIN_RATE'
  | 'KILL_SPIKE'
  | 'NO_FF_UID'
  | 'DQ_HISTORY';

export interface SuspicionSignal {
  code: SuspicionSignalCode;
  label: string;
  detail: string;
  weight: number;
}

export interface SuspiciousPlayerRow {
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
    /** withdrew − added. Positive means money left the platform via this account. */
    netOut: number;
    winRatePct: number;
    avgKills: number;
    recentAvgKills: number;
    earlierAvgKills: number;
    accountsOnDevice: number;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const COMPLETED_STATUSES = ['COMPLETED', 'UNDER_REVIEW'];

export interface SuspiciousQuery {
  /** Only return players at or above this score. */
  minScore?: number;
  limit?: number;
}

export async function listSuspiciousPlayers(
  tenantId: string,
  query: SuspiciousQuery = {},
): Promise<{ rows: SuspiciousPlayerRow[]; scannedUsers: number; minScore: number }> {
  const minScore = query.minScore ?? 30;
  const limit = Math.min(query.limit ?? 20, 100);

  // Every player in the tenant, with the data the signals need. Slots and
  // results are pulled in bulk (3 queries) rather than per player.
  const users = await prisma.user.findMany({
    where: { tenantId, role: 'USER' },
    select: {
      id: true,
      playerCode: true,
      inGameName: true,
      name: true,
      phoneNumber: true,
      inGameUid: true,
      deviceId: true,
      isBanned: true,
    },
  });
  if (users.length === 0) return { rows: [], scannedUsers: 0, minScore };

  const userIds = users.map((u) => u.id);

  const [slots, results, ledger] = await Promise.all([
    prisma.tournamentSlot.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        tournamentId: true,
        deviceIdSnapshot: true,
        inGameUidSnapshot: true,
        isBanned: true,
        joinedAt: true,
        tournament: { select: { status: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.matchResult.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        rank: true,
        verifiedKills: true,
        prizeWon: true,
        isDisqualified: true,
      },
    }),
    prisma.walletLedger.groupBy({
      by: ['userId', 'category'],
      where: { tenantId, userId: { in: userIds } },
      _sum: { amount: true },
    }),
  ]);

  // ── Ledger per user ──
  type Money = { deposited: number; withdrawn: number; prize: number };
  const money = new Map<string, Money>();
  for (const row of ledger) {
    const entry = money.get(row.userId) ?? { deposited: 0, withdrawn: 0, prize: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.category === 'ADD_MONEY') entry.deposited += amount;
    else if (row.category === 'WITHDRAWAL') entry.withdrawn += amount;
    else if (row.category === 'WINNING_PRIZE') entry.prize += amount;
    money.set(row.userId, entry);
  }

  // ── Device → accounts ──
  const accountsByDevice = new Map<string, Set<string>>();
  for (const user of users) {
    if (!user.deviceId) continue;
    const set = accountsByDevice.get(user.deviceId) ?? new Set<string>();
    set.add(user.id);
    accountsByDevice.set(user.deviceId, set);
  }
  // Match slots can carry a device the profile no longer has; count those too.
  for (const slot of slots) {
    if (!slot.deviceIdSnapshot) continue;
    const set = accountsByDevice.get(slot.deviceIdSnapshot) ?? new Set<string>();
    set.add(slot.userId);
    accountsByDevice.set(slot.deviceIdSnapshot, set);
  }

  const deviceByUser = new Map<string, string | null>();
  for (const user of users) deviceByUser.set(user.id, user.deviceId);
  for (const slot of slots) {
    if (!deviceByUser.get(slot.userId) && slot.deviceIdSnapshot) {
      deviceByUser.set(slot.userId, slot.deviceIdSnapshot);
    }
  }

  // ── Same-device collisions inside one match ──
  const playersByMatchDevice = new Map<string, Set<string>>();
  for (const slot of slots) {
    if (!slot.deviceIdSnapshot) continue;
    const key = `${slot.tournamentId}::${slot.deviceIdSnapshot}`;
    const set = playersByMatchDevice.get(key) ?? new Set<string>();
    set.add(slot.userId);
    playersByMatchDevice.set(key, set);
  }
  const collidedMatches = new Map<string, number>();
  const collisionDevices = new Map<string, Set<string>>();
  for (const [key, players] of playersByMatchDevice) {
    if (players.size < 2) continue;
    const [tournamentId, deviceId] = key.split('::');
    for (const playerId of players) {
      collidedMatches.set(playerId, (collidedMatches.get(playerId) ?? 0) + 1);
      const devices = collisionDevices.get(playerId) ?? new Set<string>();
      devices.add(deviceId);
      collisionDevices.set(playerId, devices);
    }
    void tournamentId;
  }

  // ── Per-user slot/result rollup ──
  type Rollup = {
    matchesJoined: number;
    completedMatches: number;
    booyahs: number;
    kills: number;
    recentKills: number;
    recentCount: number;
    earlierKills: number;
    earlierCount: number;
    dqCount: number;
    matchBans: number;
    slotsWithoutUid: number;
  };
  const roll = new Map<string, Rollup>();
  const bump = (userId: string): Rollup => {
    const r =
      roll.get(userId) ??
      ({
        matchesJoined: 0,
        completedMatches: 0,
        booyahs: 0,
        kills: 0,
        recentKills: 0,
        recentCount: 0,
        earlierKills: 0,
        earlierCount: 0,
        dqCount: 0,
        matchBans: 0,
        slotsWithoutUid: 0,
      } as Rollup);
    roll.set(userId, r);
    return r;
  };

  for (const slot of slots) {
    const r = bump(slot.userId);
    r.matchesJoined += 1;
    if (!slot.inGameUidSnapshot) r.slotsWithoutUid += 1;
    if (slot.isBanned) r.matchBans += 1;
  }

  // Kills trend: split the player's completed matches into older/newer halves.
  const resultsByUser = new Map<string, typeof results>();
  for (const result of results) {
    const list = resultsByUser.get(result.userId) ?? [];
    list.push(result);
    resultsByUser.set(result.userId, list);
  }
  for (const [userId, list] of resultsByUser) {
    const r = bump(userId);
    const sorted = [...list].sort((a, b) => a.rank ?? 999 - (b.rank ?? 999));
    const half = Math.floor(sorted.length / 2);
    const earlier = sorted.slice(0, half);
    const recent = sorted.slice(half);
    for (const res of list) {
      r.kills += res.verifiedKills;
      if (res.isDisqualified) r.dqCount += 1;
      if (res.rank === 1) r.booyahs += 1;
    }
    for (const res of earlier) {
      r.earlierKills += res.verifiedKills;
      r.earlierCount += 1;
    }
    for (const res of recent) {
      r.recentKills += res.verifiedKills;
      r.recentCount += 1;
    }
  }
  for (const slot of slots) {
    if (COMPLETED_STATUSES.includes(slot.tournament.status)) {
      bump(slot.userId).completedMatches += 1;
    }
  }

  // ── Score every user ──
  const rows: SuspiciousPlayerRow[] = [];
  for (const user of users) {
    const r = roll.get(user.id);
    if (!r || r.matchesJoined === 0) continue;

    const cash = money.get(user.id) ?? { deposited: 0, withdrawn: 0, prize: 0 };
    const netOut = round2(cash.withdrawn - cash.deposited);
    const deviceId = deviceByUser.get(user.id) ?? null;
    const accountsOnDevice = deviceId ? (accountsByDevice.get(deviceId)?.size ?? 1) : 1;
    const winRatePct = r.completedMatches
      ? round2((r.booyahs / r.completedMatches) * 100)
      : 0;
    const avgKills = r.completedMatches ? round2(r.kills / r.completedMatches) : 0;
    const recentAvgKills = r.recentCount ? round2(r.recentKills / r.recentCount) : 0;
    const earlierAvgKills = r.earlierCount ? round2(r.earlierKills / r.earlierCount) : 0;

    const signals: SuspicionSignal[] = [];

    if (accountsOnDevice >= 3) {
      signals.push({
        code: 'DEVICE_FARM',
        label: `${accountsOnDevice} accounts, 1 device`,
        detail: `${accountsOnDevice} accounts have played from device ${deviceId ?? '-'}.`,
        weight: Math.min(45, 15 * (accountsOnDevice - 1)),
      });
    }

    const collided = collidedMatches.get(user.id) ?? 0;
    if (collided > 0) {
      signals.push({
        code: 'DEVICE_SHARED',
        label: `${collided} match(es) with own account`,
        detail:
          'Two accounts from the same device joined the same match — the strongest ' +
          'team-up/prize-splitting signal we can prove.',
        weight: Math.min(50, 25 * collided),
      });
    }

    if (netOut > 0 && cash.prize > 0) {
      signals.push({
        code: 'NET_POSITIVE',
        label: `Took out ₹${round2(netOut)} more than paid in`,
        detail: `Added ₹${round2(cash.deposited)}, withdrew ₹${round2(
          cash.withdrawn,
        )}, won ₹${round2(cash.prize)}.`,
        weight: netOut >= 1000 ? 30 : netOut >= 300 ? 20 : 10,
      });
    }

    if (r.completedMatches >= 5 && winRatePct >= 60) {
      signals.push({
        code: 'HIGH_WIN_RATE',
        label: `${winRatePct}% win rate`,
        detail: `${r.booyahs} wins in ${r.completedMatches} completed matches.`,
        weight: winRatePct >= 80 ? 25 : 15,
      });
    }

    if (
      r.earlierCount >= 3 &&
      r.recentCount >= 3 &&
      earlierAvgKills >= 0.5 &&
      recentAvgKills >= earlierAvgKills * 3
    ) {
      signals.push({
        code: 'KILL_SPIKE',
        label: `Kills jumped ${round2(recentAvgKills / earlierAvgKills)}x`,
        detail: `Earlier ${earlierAvgKills} kills/match → recent ${recentAvgKills} kills/match.`,
        weight: 20,
      });
    }

    if (r.slotsWithoutUid > 0) {
      signals.push({
        code: 'NO_FF_UID',
        label: `${r.slotsWithoutUid} match(es) without FF UID`,
        detail: 'Joined without a Free Fire UID — cannot be paid, classic filler account.',
        weight: r.slotsWithoutUid >= 3 ? 15 : 8,
      });
    }

    if (r.dqCount > 0 || r.matchBans > 0) {
      signals.push({
        code: 'DQ_HISTORY',
        label:
          [r.dqCount > 0 ? `${r.dqCount} DQ` : null, r.matchBans > 0 ? `${r.matchBans} match-ban` : null]
            .filter(Boolean)
            .join(' · ') + ' on record',
        detail: 'Previously disqualified or banned from a match.',
        weight: 20,
      });
    }

    if (signals.length === 0) continue;
    const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
    if (score < minScore) continue;

    rows.push({
      userId: user.id,
      playerCode: user.playerCode,
      inGameName: user.inGameName,
      name: user.name,
      phoneNumber: user.phoneNumber,
      inGameUid: user.inGameUid,
      deviceId,
      isBanned: user.isBanned,
      score,
      signals: signals.sort((a, b) => b.weight - a.weight),
      stats: {
        matchesJoined: r.matchesJoined,
        completedMatches: r.completedMatches,
        totalWinnings: round2(cash.prize),
        totalDeposited: round2(cash.deposited),
        totalWithdrawn: round2(cash.withdrawn),
        netOut,
        winRatePct,
        avgKills,
        recentAvgKills,
        earlierAvgKills,
        accountsOnDevice,
      },
    });
  }

  rows.sort((a, b) => b.score - a.score || b.stats.netOut - a.stats.netOut);

  return { rows: rows.slice(0, limit), scannedUsers: users.length, minScore };
}
