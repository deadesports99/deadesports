/**
 * Phase 1 — Firestore live mirror.
 *
 * These tests never touch Firebase and need no credentials: the mirror's sink is
 * injectable, which is exactly how we prove the two promises that matter —
 *
 *   1. with the flag off, nothing changes (pure no-op), and
 *   2. with it on, a total Firestore failure can never throw, block, or grow memory.
 *
 * Gateway routing (which event goes to whom) is asserted through the additive
 * `realtimeService.setMirror()` hook, so the existing /ws contract is untouched.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';

type MirrorModule = typeof import('../src/services/liveMirror.service.js');
type RealtimeModule = typeof import('../src/services/realtime.service.js');

let liveMirrorService: MirrorModule['liveMirrorService'];
let toFirestoreSafe: MirrorModule['toFirestoreSafe'];
let realtimeService: RealtimeModule['realtimeService'];

// Loaded in `before()` (not top-level) so `process.env.NODE_ENV` is set first,
// matching how the other suites in this repo bootstrap config.
before(async () => {
  const mirror = await import('../src/services/liveMirror.service.js');
  liveMirrorService = mirror.liveMirrorService;
  toFirestoreSafe = mirror.toFirestoreSafe;

  const rt = await import('../src/services/realtime.service.js');
  realtimeService = rt.realtimeService;
});

/** Collects every document handed to the sink. */
function collector() {
  const docs: Record<string, unknown>[] = [];
  return {
    docs,
    sink: async (batch: { data: Record<string, unknown> }[]) => {
      for (const d of batch) docs.push(d.data);
    },
  };
}

const event = (type = 'SLOT_BOOKED', data: unknown = { tournamentId: 't1', slotNumber: 3 }) => ({
  type,
  data,
  timestamp: '2026-02-11T09:15:22.104Z',
  serverTimeMs: 1_770_000_000_000,
  serverTimeIst: '2026-02-11T14:45:22.104Z',
});

describe('live mirror — default state (flag off)', () => {
  it('is disabled until init/reset and publish() is a pure no-op', () => {
    assert.equal(liveMirrorService.isEnabled(), false);

    liveMirrorService.publish(event(), { audience: 'ALL' });

    const stats = liveMirrorService.stats();
    assert.equal(stats.pending, 0);
    assert.equal(stats.queued, 0);
    assert.equal(stats.written, 0);
  });
});

describe('live mirror — document shape', () => {
  beforeEach(() => {
    liveMirrorService.resetForTesting();
  });

  it('writes type, payload, audience and server timestamps', async () => {
    const { docs, sink } = collector();
    liveMirrorService.setSinkForTesting(sink);

    liveMirrorService.publish(event(), { audience: 'TENANT', tenantId: 'tenant-1' });
    await liveMirrorService.flush();

    assert.equal(docs.length, 1);
    const doc = docs[0]!;
    assert.equal(doc.type, 'SLOT_BOOKED');
    assert.equal(doc.audience, 'TENANT');
    assert.equal(doc.tenantId, 'tenant-1');
    assert.equal(doc.serverTimeMs, 1_770_000_000_000);
    assert.equal(doc.timestamp, '2026-02-11T09:15:22.104Z');
    assert.deepEqual(doc.data, { tournamentId: 't1', slotNumber: 3 });
    assert.ok(doc.createdAt instanceof Date);
    assert.ok(doc.expireAt instanceof Date);
    assert.equal(liveMirrorService.stats().written, 1);
  });

  it('maps the USER and USERS audiences onto their id fields', async () => {
    const { docs, sink } = collector();
    liveMirrorService.setSinkForTesting(sink);

    liveMirrorService.publish(event('WALLET_UPDATED'), { audience: 'USER', userId: 'u1' });
    liveMirrorService.publish(event('PRIZE_WON'), { audience: 'USERS', userIds: ['u2', 'u3'] });
    await liveMirrorService.flush();

    assert.equal(docs[0]!.userId, 'u1');
    assert.equal(docs[1]!.userIds instanceof Array, true);
    assert.deepEqual(docs[1]!.userIds, ['u2', 'u3']);
    assert.equal(docs[0]!.tenantId, undefined);
  });

  it('omits expireAt when the TTL is 0', async () => {
    liveMirrorService.resetForTesting({ ttlMs: 0 });
    const { docs, sink } = collector();
    liveMirrorService.setSinkForTesting(sink);

    liveMirrorService.publish(event(), { audience: 'ALL' });
    await liveMirrorService.flush();

    assert.equal('expireAt' in docs[0]!, false);
  });
});

describe('live mirror — bounded queue', () => {
  beforeEach(() => {
    liveMirrorService.resetForTesting({ maxQueue: 3 });
  });

  it('drops overflow instead of growing without limit', () => {
    liveMirrorService.setSinkForTesting(async () => {
      /* never flushed here */
    });

    for (let i = 0; i < 5; i += 1) {
      liveMirrorService.publish(event('MATCH_CREATED', { i }), { audience: 'ALL' });
    }

    const stats = liveMirrorService.stats();
    assert.equal(stats.pending, 3);
    assert.equal(stats.dropped, 2);
    assert.equal(stats.queued, 3);
  });
});

describe('live mirror — batching', () => {
  it('flushes at most maxBatch per call and keeps the rest queued', async () => {
    liveMirrorService.resetForTesting({ maxBatch: 2 });
    const { docs, sink } = collector();
    liveMirrorService.setSinkForTesting(sink);

    for (let i = 0; i < 5; i += 1) {
      liveMirrorService.publish(event('SLOT_BOOKED', { i }), { audience: 'ALL' });
    }

    await liveMirrorService.flush();
    assert.equal(docs.length, 2);
    assert.equal(liveMirrorService.stats().pending, 3);

    // Drain the rest the way the scheduled timer would.
    while (liveMirrorService.stats().pending > 0) {
      await liveMirrorService.flush();
    }

    assert.equal(docs.length, 5);
    assert.equal(liveMirrorService.stats().written, 5);
  });
});

describe('live mirror — never breaks the caller', () => {
  beforeEach(() => {
    liveMirrorService.resetForTesting();
  });

  it('swallows a rejected batch write and counts it', async () => {
    liveMirrorService.setSinkForTesting(async () => {
      throw new Error('firestore down');
    });

    liveMirrorService.publish(event(), { audience: 'ALL' });
    await assert.doesNotReject(() => liveMirrorService.flush());

    const stats = liveMirrorService.stats();
    assert.equal(stats.failedBatches, 1);
    assert.equal(stats.dropped, 1);
    assert.equal(stats.written, 0);
  });

  it('survives a sink that throws synchronously', async () => {
    liveMirrorService.setSinkForTesting(() => {
      throw new Error('sync boom');
    });

    liveMirrorService.publish(event(), { audience: 'ALL' });
    await assert.doesNotReject(() => liveMirrorService.flush());
    assert.equal(liveMirrorService.stats().failedBatches, 1);
  });

  it('disables itself when no Firestore sink can be resolved', async () => {
    liveMirrorService.setSinkForTesting(null); // falls through to "no credentials"
    liveMirrorService.publish(event(), { audience: 'ALL' });

    await assert.doesNotReject(() => liveMirrorService.flush());

    assert.equal(liveMirrorService.isEnabled(), false);
    assert.equal(liveMirrorService.stats().dropped, 1);
  });

  it('never throws from publish()', () => {
    liveMirrorService.setSinkForTesting(async () => {});
    assert.doesNotThrow(() => liveMirrorService.publish(event(), { audience: 'ALL' }));
  });
});

describe('live mirror — stop()', () => {
  it('flushes what is pending and turns itself off', async () => {
    liveMirrorService.resetForTesting();
    const { docs, sink } = collector();
    liveMirrorService.setSinkForTesting(sink);

    liveMirrorService.publish(event(), { audience: 'ALL' });
    liveMirrorService.publish(event('MATCH_STATUS_CHANGED'), { audience: 'ALL' });
    await liveMirrorService.stop();

    assert.equal(docs.length, 2);
    assert.equal(liveMirrorService.isEnabled(), false);
  });
});

describe('realtime gateway mirror wiring', () => {
  beforeEach(() => {
    realtimeService.setMirror(null);
  });

  it('reports the audience of all four fan-out methods', () => {
    const seen: { type: string; audience: string; tenantId?: string; userId?: string; userIds?: string[] }[] = [];
    realtimeService.setMirror((message, scope) => {
      seen.push({ type: message.type, ...scope });
    });

    realtimeService.broadcast('MATCH_CREATED', { tournamentId: 't1' });
    realtimeService.broadcastToTenant('tenant-1', 'SLOT_BOOKED', { tournamentId: 't1' });
    realtimeService.sendToUser('u1', 'WALLET_UPDATED', { balance: 100 });
    realtimeService.sendToUsers(['u2', 'u3', 'u2'], 'PRIZE_WON', { amount: 50 });

    assert.deepEqual(seen, [
      { type: 'MATCH_CREATED', audience: 'ALL' },
      { type: 'SLOT_BOOKED', audience: 'TENANT', tenantId: 'tenant-1' },
      { type: 'WALLET_UPDATED', audience: 'USER', userId: 'u1' },
      { type: 'PRIZE_WON', audience: 'USERS', userIds: ['u2', 'u3'] },
    ]);
  });

  it('never lets a broken observer break event fan-out', () => {
    realtimeService.setMirror(() => {
      throw new Error('observer exploded');
    });

    assert.doesNotThrow(() => realtimeService.broadcast('MATCH_CREATED', { tournamentId: 't1' }));
  });

  it('sends nothing extra when no mirror is attached', () => {
    realtimeService.setMirror(null);
    assert.doesNotThrow(() => realtimeService.broadcastToTenant('tenant-1', 'SLOT_BOOKED', {}));
  });
});

describe('toFirestoreSafe', () => {
  it('strips undefined (Firestore rejects it) but keeps null', () => {
    const safe = toFirestoreSafe({ a: 1, b: undefined, c: null, d: { e: undefined, f: 'x' } });
    assert.deepEqual(safe, { a: 1, c: null, d: { f: 'x' } });
  });

  it('drops undefined array entries instead of failing the batch', () => {
    assert.deepEqual(toFirestoreSafe([1, undefined, 'two', null]), [1, 'two', null]);
  });

  it('turns non-finite numbers into null', () => {
    assert.deepEqual(toFirestoreSafe({ a: NaN, b: Infinity, c: 5 }), { a: null, b: null, c: 5 });
  });

  it('truncates very long strings to stay under the 1 MiB document limit', () => {
    const safe = toFirestoreSafe('x'.repeat(50_000)) as string;
    assert.ok(safe.length < 50_000);
    assert.match(safe, /truncated/);
  });

  it('caps huge arrays so one oversized event cannot blow up a batch', () => {
    const safe = toFirestoreSafe(Array.from({ length: 900 }, (_, i) => i)) as unknown[];
    assert.equal(safe.length, 500);
  });
});
