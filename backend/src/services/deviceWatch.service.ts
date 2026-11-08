import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 🔭 DEVICE WATCHLIST
 *
 * Suspicion scoring only looks at what already happened. A watchlist looks
 * forward: the owner flags a device once, and from then on every *new* account
 * that plays from it raises an alert. That is how a banned farmer comes back
 * with a fresh account and gets caught in one match instead of twenty.
 *
 * Flow:
 *   watchDevice()        — start watching (idempotent)
 *   unwatchDevice()      — stop watching
 *   listWatchedDevices() — watchlist + any pending alerts
 *   acknowledgeAlerts()  — admin has seen it; reset the counter
 *   noteDeviceActivity() — called from joinTournament, bumps alertCount when a
 *                          fresh account appears on a watched device
 */

export interface WatchedDeviceRow {
  id: string;
  deviceId: string;
  note: string | null;
  isActive: boolean;
  alertCount: number;
  lastSeenAt: string | null;
  createdAt: string;
  accountCount: number;
  bannedCount: number;
  /** Accounts that joined while the device was being watched. */
  newAccountCount: number;
  collidedMatchCount: number;
  totalWinnings: number;
}

export interface WatchlistSummary {
  devices: WatchedDeviceRow[];
  totalWatched: number;
  totalAlerts: number;
}

/** Devices with 2+ accounts, counted the same way the device group view does. */
async function deviceStats(
  tenantId: string,
  deviceIds: string[],
): Promise<
  Map<
    string,
    {
      accountCount: number;
      bannedCount: number;
      newAccountCount: number;
      collidedMatchCount: number;
      totalWinnings: number;
    }
  >
> {
  const out = new Map<
    string,
    {
      accountCount: number;
      bannedCount: number;
      newAccountCount: number;
      collidedMatchCount: number;
      totalWinnings: number;
    }
  >();
  if (deviceIds.length === 0) return out;

  const slots = await prisma.tournamentSlot.findMany({
    where: { deviceIdSnapshot: { in: deviceIds }, user: { tenantId } },
    select: {
      userId: true,
      tournamentId: true,
      deviceIdSnapshot: true,
      user: { select: { isBanned: true, createdAt: true } },
    },
  });

  const perDevice = new Map<
    string,
    { players: Map<string, { banned: boolean; createdAt: Date }>; matches: Map<string, Set<string>> }
  >();
  for (const slot of slots) {
    if (!slot.deviceIdSnapshot) continue;
    const entry =
      perDevice.get(slot.deviceIdSnapshot) ??
      { players: new Map(), matches: new Map<string, Set<string>>() };
    entry.players.set(slot.userId, {
      banned: slot.user.isBanned,
      createdAt: slot.user.createdAt,
    });
    const playersInMatch = entry.matches.get(slot.tournamentId) ?? new Set<string>();
    playersInMatch.add(slot.userId);
    entry.matches.set(slot.tournamentId, playersInMatch);
    perDevice.set(slot.deviceIdSnapshot, entry);
  }

  // Winnings per user, one query.
  const userIds = [...new Set(slots.map((s) => s.userId))];
  const prize = new Map<string, number>();
  if (userIds.length > 0) {
    const results = await prisma.matchResult.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { prizeWon: true },
    });
    for (const row of results) prize.set(row.userId, Number(row._sum.prizeWon ?? 0));
  }

  // A "fresh" account is younger than the watch itself — handled by the caller,
  // here we only report accounts created in the last 7 days as a proxy.
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const deviceId of deviceIds) {
    const entry = perDevice.get(deviceId);
    if (!entry) {
      out.set(deviceId, {
        accountCount: 0,
        bannedCount: 0,
        newAccountCount: 0,
        collidedMatchCount: 0,
        totalWinnings: 0,
      });
      continue;
    }
    let bannedCount = 0;
    let newAccountCount = 0;
    let totalWinnings = 0;
    for (const [userId, meta] of entry.players) {
      if (meta.banned) bannedCount += 1;
      if (meta.createdAt.getTime() >= weekAgo) newAccountCount += 1;
      totalWinnings += prize.get(userId) ?? 0;
    }
    const collidedMatchCount = [...entry.matches.values()].filter((s) => s.size >= 2).length;
    out.set(deviceId, {
      accountCount: entry.players.size,
      bannedCount,
      newAccountCount,
      collidedMatchCount,
      totalWinnings: Math.round(totalWinnings * 100) / 100,
    });
  }
  return out;
}

export async function listWatchedDevices(tenantId: string): Promise<WatchlistSummary> {
  const watches = await prisma.deviceWatch.findMany({
    where: { tenantId },
    orderBy: [{ alertCount: 'desc' }, { createdAt: 'desc' }],
  });

  const stats = await deviceStats(tenantId, watches.map((w) => w.deviceId));

  const devices: WatchedDeviceRow[] = watches.map((watch) => {
    const s = stats.get(watch.deviceId);
    return {
      id: watch.id,
      deviceId: watch.deviceId,
      note: watch.note,
      isActive: watch.isActive,
      alertCount: watch.alertCount,
      lastSeenAt: watch.lastSeenAt?.toISOString() ?? null,
      createdAt: watch.createdAt.toISOString(),
      accountCount: s?.accountCount ?? 0,
      bannedCount: s?.bannedCount ?? 0,
      newAccountCount: s?.newAccountCount ?? 0,
      collidedMatchCount: s?.collidedMatchCount ?? 0,
      totalWinnings: s?.totalWinnings ?? 0,
    };
  });

  return {
    devices,
    totalWatched: devices.length,
    totalAlerts: devices.reduce((sum, d) => sum + d.alertCount, 0),
  };
}

/** Start watching a device. Idempotent — watching twice just updates the note. */
export async function watchDevice(
  tenantId: string,
  deviceId: string,
  note: string | null,
  createdBy: string | null,
): Promise<WatchedDeviceRow> {
  if (!deviceId) throw ApiError.badRequest('deviceId is required');

  const existing = await prisma.deviceWatch.findFirst({ where: { tenantId, deviceId } });
  const watch = existing
    ? await prisma.deviceWatch.update({
        where: { id: existing.id },
        data: { note: note ?? existing.note, isActive: true },
      })
    : await prisma.deviceWatch.create({
        data: { tenantId, deviceId, note, createdBy, isActive: true },
      });

  const summary = await listWatchedDevices(tenantId);
  const row = summary.devices.find((d) => d.id === watch.id);
  if (!row) throw ApiError.internal('Watch created but could not be read back');
  return row;
}

export async function unwatchDevice(
  tenantId: string,
  deviceId: string,
): Promise<{ deviceId: string; removed: number }> {
  const result = await prisma.deviceWatch.deleteMany({ where: { tenantId, deviceId } });
  return { deviceId, removed: result.count };
}

/** Admin has reviewed the device — reset the unread alert counter. */
export async function acknowledgeAlerts(
  tenantId: string,
  deviceId: string,
): Promise<{ deviceId: string; cleared: number }> {
  const existing = await prisma.deviceWatch.findFirst({ where: { tenantId, deviceId } });
  if (!existing) throw ApiError.notFound('Device is not on the watchlist');
  await prisma.deviceWatch.update({
    where: { id: existing.id },
    data: { alertCount: 0 },
  });
  return { deviceId, cleared: existing.alertCount };
}

/**
 * Called from joinTournament. If the device is being watched and this account
 * has never played from it before, raise an alert. Errors are swallowed — a
 * watchlist problem must never block a player from joining.
 */
export async function noteDeviceActivity(
  tenantId: string,
  deviceId: string | null,
  userId: string,
): Promise<void> {
  if (!deviceId) return;
  try {
    const watch = await prisma.deviceWatch.findFirst({
      where: { tenantId, deviceId, isActive: true },
    });
    if (!watch) return;

    const priorSlots = await prisma.tournamentSlot.count({
      where: { deviceIdSnapshot: deviceId, userId, tournamentId: { not: undefined } },
    });

    // First ever slot from this device → a new account appeared. Later slots
    // from the same account are not news.
    const isNewAccount = priorSlots <= 1;
    await prisma.deviceWatch.update({
      where: { id: watch.id },
      data: {
        lastSeenAt: new Date(),
        alertCount: isNewAccount ? { increment: 1 } : undefined,
      },
    });
  } catch {
    // Never let anti-cheat bookkeeping break a join.
  }
}
