/**
 * Phase 5 — daily stats snapshots → Firestore.
 *
 * Proven here (Firestore is a stub, no network, no credentials):
 *  1. the snapshot numbers match the P&L report the admin sees (same service);
 *  2. the document contains **no player identity** — counts and totals only;
 *  3. ids are idempotent (`<tenantId>_<YYYY-MM-DD>`), so a re-run overwrites;
 *  4. `tenants × days` documents, every day of the window;
 *  5. a failing write is counted, never thrown; disabled state is a clean no-op.
 *
 * Known fake limitation: FakePrisma ignores relation filters (`tournament: { tenantId }`),
 * so `counts.slotsBooked` is only asserted in the single-tenant case. Tenant
 * isolation of that count is a Prisma/Postgres guarantee, covered by the real DB.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

type StatsModule = typeof import('../src/services/statsExport.service.js');
type EnvModule = typeof import('../src/config/env.js');

let stats: StatsModule['statsExportService'];
let buildStatsDocId: StatsModule['buildStatsDocId'];
let recentDateKeys: StatsModule['recentDateKeys'];
let toDateKey: StatsModule['toDateKey'];
let env: EnvModule['env'];
let fake: FakePrisma;

const tenantId = 'tenant-1';
const otherTenantId = 'tenant-2';
const matchId = 'match-1';
const now = new Date('2026-02-11T12:00:00.000Z');
const today = '2026-02-11';

function setEnv(overrides: Record<string, unknown>): void {
  Object.assign(env as unknown as Record<string, unknown>, overrides);
}

/** One tenant with a full day of activity. */
function seedOneTenant() {
  fake = new FakePrisma({
    tenants: [
      { id: tenantId, subdomain: 'thunder', brandName: 'Thunder', isActive: true, commissionRate: 10 },
    ],
    users: [
      {
        id: 'u1',
        tenantId,
        phoneNumber: '9999900001',
        role: 'USER',
        createdAt: new Date('2026-02-11T05:00:00.000Z'),
      },
    ],
    tournaments: [
      {
        id: matchId,
        tenantId,
        title: 'Bermuda Solo #1',
        matchNumber: 1,
        matchTime: new Date('2026-02-11T14:00:00.000Z'),
        createdAt: new Date('2026-02-10T14:00:00.000Z'),
      },
    ],
    tournamentSlots: [
      {
        id: 'slot-1',
        tournamentId: matchId,
        userId: 'u1',
        slotNumber: 1,
        joinedAt: new Date('2026-02-11T09:00:00.000Z'),
      },
    ],
    depositRequests: [
      {
        id: 'dep-1',
        tenantId,
        userId: 'u1',
        amount: 100,
        utrNumber: 'UTR123456789',
        status: 'APPROVED',
        reviewedAt: new Date('2026-02-11T10:00:00.000Z'),
        createdAt: new Date('2026-02-11T09:30:00.000Z'),
      },
    ],
    walletLedger: [
      {
        id: 'led-1',
        tenantId,
        userId: 'u1',
        amount: 20,
        balanceType: 'DEPOSIT',
        type: 'DEBIT',
        category: 'JOIN_FEE',
        balanceAfter: 80,
        referenceId: matchId,
        createdAt: new Date('2026-02-11T09:05:00.000Z'),
      },
      {
        id: 'led-2',
        tenantId,
        userId: 'u1',
        amount: 15,
        balanceType: 'WINNING',
        type: 'CREDIT',
        category: 'WINNING_PRIZE',
        balanceAfter: 95,
        referenceId: matchId,
        createdAt: new Date('2026-02-11T16:00:00.000Z'),
      },
    ],
  });
  return fake;
}

function collector() {
  const docs: { id: string; data: any }[] = [];
  return {
    docs,
    sink: async (batch: { id: string; data: any }[]) => {
      for (const doc of batch) docs.push(doc);
    },
  };
}

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  const mod = await import('../src/services/statsExport.service.js');
  stats = mod.statsExportService;
  buildStatsDocId = mod.buildStatsDocId;
  recentDateKeys = mod.recentDateKeys;
  toDateKey = mod.toDateKey;
  env = (await import('../src/config/env.js')).env;
});

describe('stats — date helpers', () => {
  it('builds an idempotent document id per tenant per day', () => {
    assert.equal(buildStatsDocId('tenant-1', '2026-02-11'), 'tenant-1_2026-02-11');
  });

  it('lists the last N UTC days, oldest first, ending today', () => {
    assert.deepEqual(recentDateKeys(3, now), ['2026-02-09', '2026-02-10', '2026-02-11']);
    assert.deepEqual(recentDateKeys(1, now), ['2026-02-11']);
  });

  it('clamps the window to a sane range', () => {
    assert.equal(recentDateKeys(0, now).length, 1);
    assert.equal(recentDateKeys(999, now).length, 31);
  });

  it('formats a UTC date key', () => {
    assert.equal(toDateKey(new Date('2026-02-11T23:59:59.999Z')), '2026-02-11');
  });
});

describe('stats — snapshot content', () => {
  beforeEach(() => {
    seedOneTenant();
    stats.resetForTesting();
    setEnv({
      STATS_EXPORT_ENABLED: 'true',
      FCM_CREDENTIALS_JSON: '{"type":"service_account"}',
      STATS_EXPORT_DAYS: 1,
      STATS_EXPORT_COLLECTION: 'stats',
    });
  });

  it('matches the daily P&L figures for the tenant/day', async () => {
    const { docs, sink } = collector();
    stats.setSinkForTesting(sink);

    const result = await stats.run({ days: 1, now });

    assert.equal(result.written, 1);
    const doc = docs[0]!;
    assert.equal(doc.id, `${tenantId}_${today}`);
    assert.equal(doc.data.date, today);
    assert.equal(doc.data.tenantSubdomain, 'thunder');

    assert.equal(doc.data.money.deposits, 100, 'approved deposit');
    assert.equal(doc.data.money.entryFeesCollected, 20, 'join fee ledger');
    assert.equal(doc.data.money.prizesPaid, 15, 'prize ledger');
    assert.equal(doc.data.money.netOrganizerProfit, 5, '20 revenue - 15 prizes');
    assert.equal(doc.data.money.commissionRate, 10);
    assert.equal(doc.data.money.currency, 'INR');

    assert.equal(doc.data.counts.matchesScheduled, 1);
    assert.equal(doc.data.counts.slotsBooked, 1);
    assert.equal(doc.data.counts.newPlayers, 1);
    assert.equal(doc.data.counts.depositCount, 1);
  });

  it('carries no player identity or balances', async () => {
    const { docs, sink } = collector();
    stats.setSinkForTesting(sink);
    await stats.run({ days: 1, now });

    const serialised = JSON.stringify(docs[0]!.data);
    for (const forbidden of ['phoneNumber', '9999900001', 'email', 'userId', 'winfo']) {
      assert.equal(serialised.includes(forbidden), false, `must not contain ${forbidden}`);
    }
  });

  it('marks the document as derived from postgres', async () => {
    const { docs, sink } = collector();
    stats.setSinkForTesting(sink);
    await stats.run({ days: 1, now });

    assert.equal(docs[0]!.data.source, 'postgres');
    assert.equal(docs[0]!.data.version, 1);
    assert.ok(docs[0]!.data.computedAt);
  });

  it('is idempotent: a second run writes the same document ids', async () => {
    const first = collector();
    stats.setSinkForTesting(first.sink);
    await stats.run({ days: 1, now });

    const second = collector();
    stats.setSinkForTesting(second.sink);
    await stats.run({ days: 1, now });

    assert.deepEqual(
      first.docs.map((d) => d.id),
      second.docs.map((d) => d.id),
    );
    assert.equal(second.docs.length, 1, 'overwrites, never duplicates');
  });
});

describe('stats — window and multi-tenant', () => {
  it('writes tenants × days documents', async () => {
    fake = new FakePrisma({
      tenants: [
        { id: tenantId, subdomain: 'thunder', brandName: 'Thunder', isActive: true },
        { id: otherTenantId, subdomain: 'blaze', brandName: 'Blaze', isActive: true },
        { id: 'tenant-off', subdomain: 'paused', brandName: 'Paused', isActive: false },
      ],
      users: [],
      tournaments: [],
      tournamentSlots: [],
      walletLedger: [],
      depositRequests: [],
    });
    stats.resetForTesting();
    setEnv({ STATS_EXPORT_ENABLED: 'true', FCM_CREDENTIALS_JSON: '{"type":"service_account"}' });

    const { docs, sink } = collector();
    stats.setSinkForTesting(sink);

    const result = await stats.run({ days: 3, now });

    assert.equal(result.tenants, 2, 'inactive tenant skipped');
    assert.equal(result.written, 6, '2 active tenants × 3 days');
    assert.equal(docs.length, 6);
    assert.equal(
      docs.some((d) => d.id.startsWith('tenant-off_')),
      false,
      'inactive tenant never exported',
    );
    assert.deepEqual(
      [...new Set(docs.map((d) => d.data.date))].sort(),
      ['2026-02-09', '2026-02-10', '2026-02-11'],
    );
  });
});

describe('stats — degradation', () => {
  beforeEach(() => {
    seedOneTenant();
    stats.resetForTesting();
  });

  it('is a clean no-op while the flag is off', async () => {
    setEnv({
      STATS_EXPORT_ENABLED: 'false',
      FCM_CREDENTIALS_JSON: '{"type":"service_account"}',
    });

    const result = await stats.run({ days: 1, now });

    assert.equal(result.enabled, false);
    assert.equal(result.written, 0);
    assert.match(result.skippedReason ?? '', /STATS_EXPORT_ENABLED/);
  });

  it('runs anyway when forced (CLI backfill path)', async () => {
    setEnv({ STATS_EXPORT_ENABLED: 'false', FCM_CREDENTIALS_JSON: '{"type":"service_account"}' });
    const { docs, sink } = collector();
    stats.setSinkForTesting(sink);

    const result = await stats.run({ days: 1, now, force: true });

    assert.equal(result.written, 1);
    assert.equal(docs.length, 1);
  });

  it('refuses to pretend it worked without credentials', async () => {
    setEnv({ STATS_EXPORT_ENABLED: 'true', FCM_CREDENTIALS_JSON: '' });

    const result = await stats.run({ days: 1, now, force: true });

    assert.equal(result.enabled, false);
    assert.match(result.skippedReason ?? '', /service account/);
  });

  it('counts a failed write instead of throwing', async () => {
    setEnv({ STATS_EXPORT_ENABLED: 'true', FCM_CREDENTIALS_JSON: '{"type":"service_account"}' });
    stats.setSinkForTesting(async () => {
      throw new Error('firestore down');
    });

    const result = await doesNotRejectAsync(() => stats.run({ days: 1, now }));

    assert.equal(result.written, 0);
    assert.equal(result.failed, 1);
  });
});

/** Local helper: assert.rejects/doesNotReject return void, we need the value. */
async function doesNotRejectAsync<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    assert.fail(`expected no rejection, got: ${(err as Error).message}`);
  }
}
