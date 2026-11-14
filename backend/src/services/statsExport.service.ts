import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { getFirebaseApp } from './firebase.service.js';
import { getDailySettlement } from './settlement.service.js';

/**
 * Daily statistics snapshot → Firestore (Phase 5 —
 * plan/firebase-migration/PHASE-5-STATS-EXPORT.md).
 *
 * This is the honest answer to "put our data in Firebase":
 *
 *   - the **ledger stays in PostgreSQL**, because that is where money is safe;
 *   - Firebase receives **one aggregate document per tenant per day** — counts and
 *     totals only, no player identity, no balances, no phone numbers;
 *   - dashboards/reporting can then read a tiny, cheap, pre-aggregated collection
 *     instead of scanning the ledger.
 *
 * Numbers come from `getDailySettlement()` — the same, already-tested service the
 * owner's daily P&L screen uses — so the snapshot can never disagree with the report
 * the admin is looking at.
 *
 * Safety rules, same as every other phase:
 *   1. OFF by default (`STATS_EXPORT_ENABLED=false`).
 *   2. Idempotent: the document id is `<tenantId>_<YYYY-MM-DD>`, so a re-run
 *      overwrites instead of duplicating.
 *   3. One tenant failing never stops the others.
 *   4. Never throws into the caller (scheduler-safe).
 *   5. Write volume is `tenants × days` documents per run — trivially cheap.
 */

export interface StatsMoney {
  /** Approved "Add Cash" deposits settled on the day, in rupees. */
  deposits: number;
  withdrawals: number;
  entryFeesCollected: number;
  prizesPaid: number;
  netOrganizerProfit: number;
  platformCut: number;
  commissionRate: number;
  currency: 'INR';
}

export interface StatsCounts {
  depositCount: number;
  withdrawalCount: number;
  prizeCount: number;
  /** Matches whose scheduled start falls on this day. */
  matchesScheduled: number;
  /** Seats booked on this day. */
  slotsBooked: number;
  /** New player accounts created on this day. */
  newPlayers: number;
}

export interface StatsSnapshot {
  tenantId: string;
  tenantSubdomain: string;
  /** `YYYY-MM-DD` (UTC day, matching the existing settlement report). */
  date: string;
  money: StatsMoney;
  counts: StatsCounts;
  computedAt: string;
  source: 'postgres';
  version: 1;
}

export interface StatsDoc {
  id: string;
  data: StatsSnapshot;
}

/** Writes one batch of snapshots. Injectable so tests never touch the network. */
export type StatsSink = (docs: StatsDoc[]) => Promise<void>;

export interface StatsExportResult {
  enabled: boolean;
  skippedReason?: string;
  documents: number;
  written: number;
  failed: number;
  tenants: number;
  dates: string[];
}

const BATCH_SIZE = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Idempotency key — one document per tenant per day, so re-runs overwrite. */
export function buildStatsDocId(tenantId: string, date: string): string {
  return `${tenantId}_${date}`;
}

/** `YYYY-MM-DD` for the UTC day containing `date`. */
export function toDateKey(date: Date): string {
  return new Date(date.getTime()).toISOString().slice(0, 10);
}

/** Oldest → newest list of the last `days` UTC dates (today included). */
export function recentDateKeys(days: number, now: Date = new Date()): string[] {
  const total = Math.max(1, Math.min(days, 31));
  const keys: string[] = [];
  for (let offset = total - 1; offset >= 0; offset -= 1) {
    keys.push(toDateKey(new Date(now.getTime() - offset * DAY_MS)));
  }
  return keys;
}

/** UTC [start, end) range for a `YYYY-MM-DD` key — same window the P&L report uses. */
function dayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

let sink: StatsSink | null = null;
let injectedSink: StatsSink | null = null;
let scheduler: NodeJS.Timeout | null = null;

async function resolveSink(): Promise<StatsSink | null> {
  if (injectedSink) return injectedSink;
  if (sink) return sink;

  try {
    const app = getFirebaseApp();
    if (!app || !env.FCM_CREDENTIALS_JSON) return null;

    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore(app);
    const collection = db.collection(env.STATS_EXPORT_COLLECTION);

    sink = async (docs: StatsDoc[]): Promise<void> => {
      const batch = db.batch();
      for (const doc of docs) batch.set(collection.doc(doc.id), doc.data);
      await batch.commit();
    };
    return sink;
  } catch (err) {
    console.warn('[stats] Firestore client unavailable:', (err as Error).message);
    return null;
  }
}

/** Build the snapshot for one tenant/day. Exported for direct testing. */
export async function buildSnapshot(
  tenant: { id: string; subdomain: string },
  dateKey: string,
  computedAt: Date = new Date(),
): Promise<StatsSnapshot> {
  const { start, end } = dayBounds(dateKey);

  const [settlement, matchesScheduled, slotsBooked, newPlayers] = await Promise.all([
    getDailySettlement(tenant.id, dateKey),
    prisma.tournament.count({ where: { tenantId: tenant.id, matchTime: { gte: start, lt: end } } }),
    prisma.tournamentSlot.count({
      where: { joinedAt: { gte: start, lt: end }, tournament: { tenantId: tenant.id } },
    }),
    prisma.user.count({
      where: { tenantId: tenant.id, role: 'USER', createdAt: { gte: start, lt: end } },
    }),
  ]);

  const summary = settlement.summary;

  return {
    tenantId: tenant.id,
    tenantSubdomain: tenant.subdomain,
    date: dateKey,
    money: {
      deposits: summary.totalDeposits,
      withdrawals: summary.totalWithdrawals,
      entryFeesCollected: summary.totalMatchRevenue,
      prizesPaid: summary.totalPrizesPaid,
      netOrganizerProfit: summary.netOrganizerProfit,
      platformCut: summary.platformCut,
      commissionRate: summary.commissionRate,
      currency: 'INR',
    },
    counts: {
      depositCount: summary.depositCount,
      withdrawalCount: summary.withdrawalCount,
      prizeCount: summary.prizeCount,
      matchesScheduled,
      slotsBooked,
      newPlayers,
    },
    computedAt: computedAt.toISOString(),
    source: 'postgres',
    version: 1,
  };
}

class StatsExportService {
  /**
   * Recompute the last N days for every active tenant and write the snapshots.
   *
   * `force: true` runs even when `STATS_EXPORT_ENABLED` is false — that is how the
   * CLI backfill works on a machine where the scheduler is intentionally off.
   */
  public async run(options: { days?: number; now?: Date; force?: boolean } = {}): Promise<StatsExportResult> {
    const days = options.days ?? env.STATS_EXPORT_DAYS;
    const now = options.now ?? new Date();
    const dates = recentDateKeys(days, now);

    const skipped = (reason: string): StatsExportResult => ({
      enabled: false,
      skippedReason: reason,
      documents: 0,
      written: 0,
      failed: 0,
      tenants: 0,
      dates,
    });

    if (!options.force && env.STATS_EXPORT_ENABLED !== 'true') {
      return skipped('STATS_EXPORT_ENABLED is false');
    }
    if (!env.FCM_CREDENTIALS_JSON) {
      return skipped('FCM_CREDENTIALS_JSON is missing — Firestore writes need a service account');
    }

    let tenants: { id: string; subdomain: string; brandName: string }[] = [];
    try {
      tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, subdomain: true, brandName: true },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      console.warn('[stats] could not list tenants:', (err as Error).message);
      return skipped('tenant list unavailable');
    }

    if (tenants.length === 0) {
      return { enabled: true, documents: 0, written: 0, failed: 0, tenants: 0, dates };
    }

    const docs: StatsDoc[] = [];
    let failed = 0;

    for (const tenant of tenants) {
      for (const dateKey of dates) {
        try {
          const snapshot = await buildSnapshot(tenant, dateKey, now);
          docs.push({ id: buildStatsDocId(tenant.id, dateKey), data: snapshot });
        } catch (err) {
          failed += 1;
          console.warn(
            `[stats] ${tenant.subdomain} ${dateKey} failed:`,
            (err as Error).message,
          );
        }
      }
    }

    if (docs.length === 0) {
      return { enabled: true, documents: 0, written: 0, failed, tenants: tenants.length, dates };
    }

    const writer = await resolveSink();
    if (!writer) {
      return skipped('no usable Firestore writer');
    }

    let written = 0;
    for (let index = 0; index < docs.length; index += BATCH_SIZE) {
      const batch = docs.slice(index, index + BATCH_SIZE);
      try {
        await writer(batch);
        written += batch.length;
      } catch (err) {
        failed += batch.length;
        console.warn('[stats] batch write failed:', (err as Error).message);
      }
    }

    return {
      enabled: true,
      documents: docs.length,
      written,
      failed,
      tenants: tenants.length,
      dates,
    };
  }

  /** Nightly refresh. Recomputes a small window so one missed night heals itself. */
  public startScheduler(): void {
    if (env.STATS_EXPORT_ENABLED !== 'true' || scheduler) return;

    const tick = (): void => {
      void this.run()
        .then((result) => {
          if (result.written > 0) {
            console.log(
              `📊 Stats snapshots written: ${result.written}` +
                (result.failed ? ` (${result.failed} failed)` : ''),
            );
          }
        })
        .catch((err) => console.error('[stats] scheduler run failed:', err));
    };

    // Heal shortly after boot, then on the configured cadence.
    setTimeout(tick, 60_000).unref?.();
    scheduler = setInterval(tick, env.STATS_EXPORT_INTERVAL_HOURS * 60 * 60 * 1000);
    scheduler.unref?.();

    console.log(
      `📊 Stats export ON — every ${env.STATS_EXPORT_INTERVAL_HOURS}h, ` +
        `last ${env.STATS_EXPORT_DAYS} day(s) → "${env.STATS_EXPORT_COLLECTION}"`,
    );
  }

  public stopScheduler(): void {
    if (scheduler) {
      clearInterval(scheduler);
      scheduler = null;
    }
  }

  // ─── Test seams (not used in production paths) ─────────────────────────

  public setSinkForTesting(next: StatsSink | null): void {
    injectedSink = next;
  }

  public resetForTesting(): void {
    injectedSink = null;
    sink = null;
    this.stopScheduler();
  }
}

export const statsExportService = new StatsExportService();
