import { csvEscape } from '../utils/csv.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 📱 DEVICE GROUPS
 *
 * One phone, many accounts. This is where prize-farming actually shows up: a
 * single device fills several seats in the same room, or one account wins while
 * the others quietly absorb losses.
 *
 * Two views:
 *   listDeviceGroups()  — every device with 2+ accounts, ranked by risk
 *   getDeviceGroup()    — one device in full: every account, where they met,
 *                         who won what, and the money trail
 *
 * Nothing here bans. `banDeviceAccounts()` is a separate, explicit action.
 */

export interface DeviceAccountRow {
  userId: string;
  playerCode: string | null;
  inGameName: string | null;
  name: string | null;
  phoneNumber: string;
  inGameUid: string | null;
  isBanned: boolean;
  matchesJoined: number;
  /** Matches where this account and another account on the same device both played. */
  collidedMatches: number;
  totalWinnings: number;
  totalDeposited: number;
  totalWithdrawn: number;
  /** withdrew − added. Positive = money left the platform through this account. */
  netOut: number;
  createdAt: string;
  lastPlayedAt: string | null;
}

export interface DeviceGroupRow {
  deviceId: string;
  accountCount: number;
  /** Distinct matches where 2+ accounts from this device both played. */
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

const round2 = (n: number): number => Math.round(n * 100) / 100;

type Money = { deposited: number; withdrawn: number; prize: number };

async function loadMoneyByUser(tenantId: string, userIds: string[]): Promise<Map<string, Money>> {
  const out = new Map<string, Money>();
  if (userIds.length === 0) return out;
  const rows = await prisma.walletLedger.groupBy({
    by: ['userId', 'category'],
    where: { tenantId, userId: { in: userIds } },
    _sum: { amount: true },
  });
  for (const row of rows) {
    const entry = out.get(row.userId) ?? { deposited: 0, withdrawn: 0, prize: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.category === 'ADD_MONEY') entry.deposited += amount;
    else if (row.category === 'WITHDRAWAL') entry.withdrawn += amount;
    else if (row.category === 'WINNING_PRIZE') entry.prize += amount;
    out.set(row.userId, entry);
  }
  return out;
}

/** Every device with 2+ accounts, ranked by how risky it looks. */
export async function listDeviceGroups(
  tenantId: string,
  options: { minAccounts?: number; limit?: number } = {},
): Promise<{ groups: DeviceGroupRow[]; totalDevices: number; minAccounts: number }> {
  const minAccounts = Math.max(2, options.minAccounts ?? 2);
  const limit = Math.min(options.limit ?? 30, 200);

  const users = await prisma.user.findMany({
    where: { tenantId, role: 'USER', deviceId: { not: null } },
    select: {
      id: true,
      playerCode: true,
      inGameName: true,
      isBanned: true,
      deviceId: true,
    },
  });

  // Slots can carry a device snapshot the profile no longer has; include those.
  const slots = await prisma.tournamentSlot.findMany({
    where: { user: { tenantId }, deviceIdSnapshot: { not: null } },
    select: { userId: true, tournamentId: true, deviceIdSnapshot: true },
  });

  // device → { user → set<tournamentId> }
  const byDevice = new Map<string, Map<string, Set<string>>>();
  const addSlot = (deviceId: string, userId: string, tournamentId: string): void => {
    const users_ = byDevice.get(deviceId) ?? new Map<string, Set<string>>();
    const matches = users_.get(userId) ?? new Set<string>();
    matches.add(tournamentId);
    users_.set(userId, matches);
    byDevice.set(deviceId, users_);
  };
  for (const slot of slots) {
    if (slot.deviceIdSnapshot) addSlot(slot.deviceIdSnapshot, slot.userId, slot.tournamentId);
  }
  for (const user of users) {
    if (user.deviceId && !byDevice.has(user.deviceId)) {
      byDevice.set(user.deviceId, new Map([[user.id, new Set<string>()]]));
    }
  }

  const qualifying = [...byDevice.entries()].filter(([, accounts]) => accounts.size >= minAccounts);
  if (qualifying.length === 0) {
    return { groups: [], totalDevices: byDevice.size, minAccounts };
  }

  const allUserIds = [...new Set(qualifying.flatMap(([, accounts]) => [...accounts.keys()]))];
  const money = await loadMoneyByUser(tenantId, allUserIds);

  const userMeta = new Map(users.map((u) => [u.id, u]));

  const groups: DeviceGroupRow[] = qualifying.map(([deviceId, accounts]) => {
    // Matches where 2+ accounts of this device appear together.
    const playersPerMatch = new Map<string, number>();
    for (const matches of accounts.values()) {
      for (const tournamentId of matches) {
        playersPerMatch.set(tournamentId, (playersPerMatch.get(tournamentId) ?? 0) + 1);
      }
    }
    const collided = [...playersPerMatch.values()].filter((n) => n >= 2).length;

    let totalWinnings = 0;
    let netOut = 0;
    let bannedCount = 0;
    const accountRows: DeviceGroupRow['accounts'] = [];

    for (const userId of accounts.keys()) {
      const cash = money.get(userId) ?? { deposited: 0, withdrawn: 0, prize: 0 };
      totalWinnings += cash.prize;
      netOut += cash.withdrawn - cash.deposited;
      const meta = userMeta.get(userId);
      const isBanned = meta?.isBanned ?? false;
      if (isBanned) bannedCount += 1;
      accountRows.push({
        userId,
        playerCode: meta?.playerCode ?? null,
        inGameName: meta?.inGameName ?? null,
        isBanned,
      });
    }

    return {
      deviceId,
      accountCount: accounts.size,
      collidedMatchCount: collided,
      totalWinnings: round2(totalWinnings),
      netOut: round2(netOut),
      bannedCount,
      accounts: accountRows.sort((a, b) => (a.playerCode ?? '').localeCompare(b.playerCode ?? '')),
    };
  });

  // Rank: matches where they met each other first, then headcount, then money out.
  groups.sort(
    (a, b) =>
      b.collidedMatchCount - a.collidedMatchCount ||
      b.accountCount - a.accountCount ||
      b.netOut - a.netOut,
  );

  return { groups: groups.slice(0, limit), totalDevices: byDevice.size, minAccounts };
}

/** One device in full — the investigation screen. */
export async function getDeviceGroup(
  tenantId: string,
  deviceId: string,
): Promise<{
  deviceId: string;
  accounts: DeviceAccountRow[];
  /** Matches where 2+ of these accounts played together. */
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
}> {
  if (!deviceId) throw ApiError.badRequest('deviceId is required');

  const slots = await prisma.tournamentSlot.findMany({
    where: { deviceIdSnapshot: deviceId, user: { tenantId } },
    select: {
      userId: true,
      tournamentId: true,
      joinedAt: true,
      tournament: {
        select: { id: true, matchNumber: true, mapType: true, matchType: true, status: true },
      },
      user: {
        select: {
          id: true,
          playerCode: true,
          inGameName: true,
          name: true,
          phoneNumber: true,
          inGameUid: true,
          isBanned: true,
          createdAt: true,
        },
      },
    },
  });

  // Accounts that only exist on the profile (never joined a match from it).
  const profileUsers = await prisma.user.findMany({
    where: { tenantId, role: 'USER', deviceId },
    select: {
      id: true,
      playerCode: true,
      inGameName: true,
      name: true,
      phoneNumber: true,
      inGameUid: true,
      isBanned: true,
      createdAt: true,
    },
  });

  if (slots.length === 0 && profileUsers.length === 0) {
    throw ApiError.notFound('No accounts found on this device');
  }

  type Acc = {
    meta: {
      id: string;
      playerCode: string | null;
      inGameName: string | null;
      name: string | null;
      phoneNumber: string;
      inGameUid: string | null;
      isBanned: boolean;
      createdAt: Date;
    };
    matches: Set<string>;
    lastPlayedAt: Date | null;
  };
  const accMap = new Map<string, Acc>();
  const ensure = (meta: Acc['meta']): Acc => {
    const existing = accMap.get(meta.id);
    if (existing) return existing;
    const fresh: Acc = { meta, matches: new Set<string>(), lastPlayedAt: null };
    accMap.set(meta.id, fresh);
    return fresh;
  };

  for (const slot of slots) {
    const acc = ensure(slot.user);
    acc.matches.add(slot.tournamentId);
    if (!acc.lastPlayedAt || slot.joinedAt > acc.lastPlayedAt) acc.lastPlayedAt = slot.joinedAt;
  }
  for (const user of profileUsers) ensure(user);

  const userIds = [...accMap.keys()];
  const money = await loadMoneyByUser(tenantId, userIds);

  // Which accounts met each other, and in which match.
  const accountsPerMatch = new Map<string, string[]>();
  for (const slot of slots) {
    const list = accountsPerMatch.get(slot.tournamentId) ?? [];
    list.push(slot.userId);
    accountsPerMatch.set(slot.tournamentId, list);
  }
  const tournamentMeta = new Map(slots.map((s) => [s.tournamentId, s.tournament]));

  let collidedMatchCount = 0;
  const sharedMatches: Array<{
    tournamentId: string;
    matchNumber: number | null;
    mapType: string;
    matchType: string;
    status: string;
    accountCodes: string[];
  }> = [];
  const collidedPerAccount = new Map<string, number>();

  for (const [tournamentId, userIdList] of accountsPerMatch) {
    const unique = [...new Set(userIdList)];
    if (unique.length < 2) continue;
    collidedMatchCount += 1;
    for (const id of unique) collidedPerAccount.set(id, (collidedPerAccount.get(id) ?? 0) + 1);
    const meta = tournamentMeta.get(tournamentId);
    sharedMatches.push({
      tournamentId,
      matchNumber: meta?.matchNumber ?? null,
      mapType: meta?.mapType ?? '',
      matchType: meta?.matchType ?? '',
      status: meta?.status ?? '',
      accountCodes: unique.map((id) => accMap.get(id)?.meta.playerCode ?? id.slice(0, 8)),
    });
  }
  sharedMatches.sort((a, b) => (b.matchNumber ?? 0) - (a.matchNumber ?? 0));

  const accounts: DeviceAccountRow[] = [...accMap.values()].map((acc) => {
    const cash = money.get(acc.meta.id) ?? { deposited: 0, withdrawn: 0, prize: 0 };
    return {
      userId: acc.meta.id,
      playerCode: acc.meta.playerCode,
      inGameName: acc.meta.inGameName,
      name: acc.meta.name,
      phoneNumber: acc.meta.phoneNumber,
      inGameUid: acc.meta.inGameUid,
      isBanned: acc.meta.isBanned,
      matchesJoined: acc.matches.size,
      collidedMatches: collidedPerAccount.get(acc.meta.id) ?? 0,
      totalWinnings: round2(cash.prize),
      totalDeposited: round2(cash.deposited),
      totalWithdrawn: round2(cash.withdrawn),
      netOut: round2(cash.withdrawn - cash.deposited),
      createdAt: acc.meta.createdAt.toISOString(),
      lastPlayedAt: acc.lastPlayedAt?.toISOString() ?? null,
    };
  });

  accounts.sort(
    (a, b) =>
      b.collidedMatches - a.collidedMatches ||
      b.totalWinnings - a.totalWinnings ||
      (a.playerCode ?? '').localeCompare(b.playerCode ?? ''),
  );

  const totalWinnings = accounts.reduce((s, a) => s + a.totalWinnings, 0);
  const totalDeposited = accounts.reduce((s, a) => s + a.totalDeposited, 0);
  const totalWithdrawn = accounts.reduce((s, a) => s + a.totalWithdrawn, 0);

  return {
    deviceId,
    accounts,
    sharedMatches,
    totals: {
      accountCount: accounts.length,
      bannedCount: accounts.filter((a) => a.isBanned).length,
      collidedMatchCount,
      totalWinnings: round2(totalWinnings),
      totalDeposited: round2(totalDeposited),
      totalWithdrawn: round2(totalWithdrawn),
      netOut: round2(totalWithdrawn - totalDeposited),
    },
  };
}

/**
 * Ban (or unban) every account on a device in one action.
 * Explicitly opt-in — the UI must confirm first. Sessions die instantly.
 */
export async function banDeviceAccounts(
  tenantId: string,
  deviceId: string,
  isBanned: boolean,
): Promise<{ deviceId: string; requested: number; updated: number; accounts: string[] }> {
  if (!deviceId) throw ApiError.badRequest('deviceId is required');

  const targets = await prisma.user.findMany({
    where: { tenantId, role: 'USER', deviceId },
    select: { id: true, playerCode: true },
  });

  const slotUsers = await prisma.tournamentSlot.findMany({
    where: { deviceIdSnapshot: deviceId, user: { tenantId } },
    select: { userId: true },
  });
  const ids = [
    ...new Set([...targets.map((t) => t.id), ...slotUsers.map((s) => s.userId)]),
  ];
  if (ids.length === 0) throw ApiError.notFound('No accounts found on this device');

  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isBanned } });

  // Kill every session immediately instead of waiting for the cache TTL.
  const { invalidateAuthCache } = await import('../middlewares/auth.middleware.js');
  for (const id of ids) invalidateAuthCache(id);

  return {
    deviceId,
    requested: ids.length,
    updated: ids.length,
    accounts: targets.map((t) => t.playerCode ?? t.id.slice(0, 8)),
  };
}

// ─── CSV export (dispute / record keeping) ────────────────────────────────

const formatIst = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
};

/**
 * Two-block CSV for one device: a summary header (totals + how much money left
 * the platform) then one row per account. Same shape as the roster and
 * settlement exports so a spreadsheet can line them up.
 */
export function buildDeviceCsv(detail: Awaited<ReturnType<typeof getDeviceGroup>>): string {
  const lines: string[] = [];
  const t = detail.totals;

  lines.push(`Device,${csvEscape(detail.deviceId)}`);
  lines.push(`Accounts,${t.accountCount}`);
  lines.push(`Banned,${t.bannedCount}`);
  lines.push(`Matches Played Together,${t.collidedMatchCount}`);
  lines.push(`Total Winnings,${t.totalWinnings}`);
  lines.push(`Total Added,${t.totalDeposited}`);
  lines.push(`Total Withdrawn,${t.totalWithdrawn}`);
  lines.push(`Net Out (withdrawn - added),${t.netOut}`);
  lines.push('');

  lines.push(
    [
      'Player ID',
      'In-Game Name',
      'Name',
      'FF UID',
      'Phone',
      'Banned',
      'Matches',
      'Played Together',
      'Winnings',
      'Added',
      'Withdrawn',
      'Net Out',
      'Created At (IST)',
      'Last Played (IST)',
    ].join(','),
  );

  for (const account of detail.accounts) {
    lines.push(
      [
        csvEscape(account.playerCode),
        csvEscape(account.inGameName),
        csvEscape(account.name),
        csvEscape(account.inGameUid),
        csvEscape(account.phoneNumber),
        account.isBanned ? 'YES' : 'no',
        account.matchesJoined,
        account.collidedMatches,
        account.totalWinnings,
        account.totalDeposited,
        account.totalWithdrawn,
        account.netOut,
        formatIst(account.createdAt),
        formatIst(account.lastPlayedAt),
      ].join(','),
    );
  }

  if (detail.sharedMatches.length > 0) {
    lines.push('');
    lines.push('Matches Played Together');
    lines.push(['Match Number', 'Map', 'Mode', 'Status', 'Accounts'].join(','));
    for (const match of detail.sharedMatches) {
      lines.push(
        [
          match.matchNumber ?? '',
          csvEscape(match.mapType),
          csvEscape(match.matchType),
          csvEscape(match.status),
          csvEscape(match.accountCodes.join(' | ')),
        ].join(','),
      );
    }
  }

  return lines.join('\r\n');
}
