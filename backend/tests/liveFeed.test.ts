/**
 * Phase 2 — live feed reader.
 *
 * Proves the four things that matter before this endpoint is switched on:
 *  1. scope filtering happens from the verified identity, not from the request;
 *  2. the monthly read budget actually stops the Firestore call;
 *  3. the cursor advances so a client cannot re-read the same page forever;
 *  4. every failure mode degrades to a well-formed answer, never a 500.
 *
 * Firestore is faked in-memory: no credentials, no network, no cost.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';

type FeedModule = typeof import('../src/services/liveFeed.service.js');
type EnvModule = typeof import('../src/config/env.js');

let liveFeedService: FeedModule['liveFeedService'];
let env: EnvModule['env'];

/** The env object is a plain parsed object, so tests can flip flags per case. */
function setEnv(overrides: Record<string, unknown>): void {
  Object.assign(env as unknown as Record<string, unknown>, overrides);
}

interface Row {
  id: string;
  doc: Record<string, any>;
}

/**
 * Minimal Firestore stand-in: `collection().where().orderBy().limit().get()`.
 * Supports only the three operators the feed actually uses.
 */
function fakeStore(rows: Row[]) {
  const stats = { collectionCalls: 0 };

  function builder(): any {
    const predicates: ((doc: Record<string, any>) => boolean)[] = [];
    let orderField: string | null = null;
    let max = Infinity;

    const api: any = {
      where(field: string, op: string, value: unknown) {
        if (op === '==') predicates.push((doc) => doc[field] === value);
        else if (op === '>') predicates.push((doc) => Number(doc[field]) > Number(value));
        else if (op === 'array-contains') {
          predicates.push((doc) => Array.isArray(doc[field]) && doc[field].includes(value));
        } else throw new Error(`fakeStore: unsupported operator ${op}`);
        return api;
      },
      orderBy(field: string) {
        orderField = field;
        return api;
      },
      limit(n: number) {
        max = n;
        return api;
      },
      async get() {
        let matched = rows.filter((row) => predicates.every((predicate) => predicate(row.doc)));
        if (orderField) {
          const field = orderField;
          matched = [...matched].sort((a, b) => Number(a.doc[field]) - Number(b.doc[field]));
        }
        matched = matched.slice(0, max);
        return { docs: matched.map((row) => ({ id: row.id, data: () => row.doc })) };
      },
    };
    return api;
  }

  return {
    stats,
    store: {
      collection() {
        stats.collectionCalls += 1;
        return builder();
      },
    },
  };
}

const row = (
  id: string,
  overrides: Partial<Record<string, any>> & { serverTimeMs: number },
): Row => ({
  id,
  doc: {
    type: 'SLOT_BOOKED',
    data: { tournamentId: 't1' },
    audience: 'ALL',
    timestamp: new Date(overrides.serverTimeMs).toISOString(),
    ...overrides,
  },
});

const scope = { userId: 'u1', tenantId: 'tenant-1' };

/** Await a promise, failing the test (rather than erroring) when it rejects. */
async function mustResolve<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    assert.fail(`expected no rejection, got: ${(err as Error).message}`);
  }
}

describe('live feed — disabled by default', () => {
  before(async () => {
    const feed = await import('../src/services/liveFeed.service.js');
    liveFeedService = feed.liveFeedService;
    env = (await import('../src/config/env.js')).env;
  });

  beforeEach(() => {
    liveFeedService.setStoreForTesting(null);
    liveFeedService.setBudgetStoreForTesting(null);
    setEnv({
      LIVE_FEED_ENABLED: 'false',
      LIVE_FEED_MAX_LIMIT: 50,
      LIVE_FEED_DEFAULT_LIMIT: 25,
      LIVE_FEED_MONTHLY_READ_BUDGET: 500_000,
    });
  });

  it('reports source "disabled" and never touches Firestore', async () => {
    const fake = fakeStore([row('a', { serverTimeMs: 1000 })]);
    liveFeedService.setStoreForTesting(fake.store);
    liveFeedService.setBudgetStoreForTesting({ read: async () => 0, charge: async () => {} });

    const result = await liveFeedService.read(scope, 0);

    assert.equal(result.source, 'disabled');
    assert.equal(result.enabled, false);
    assert.deepEqual(result.events, []);
    assert.equal(fake.stats.collectionCalls, 0);
  });
});

describe('live feed — scope filtering', () => {
  before(async () => {
    const feed = await import('../src/services/liveFeed.service.js');
    liveFeedService = feed.liveFeedService;
    env = (await import('../src/config/env.js')).env;
  });

  beforeEach(() => {
    liveFeedService.setBudgetStoreForTesting({ read: async () => 0, charge: async () => {} });
    setEnv({
      LIVE_FEED_ENABLED: 'true',
      LIVE_FEED_MAX_LIMIT: 50,
      LIVE_FEED_DEFAULT_LIMIT: 25,
      LIVE_FEED_MONTHLY_READ_BUDGET: 500_000,
    });
  });

  it('returns only the events this player is allowed to see', async () => {
    const fake = fakeStore([
      row('all', { serverTimeMs: 1000, audience: 'ALL' }),
      row('my-tenant', { serverTimeMs: 1010, audience: 'TENANT', tenantId: 'tenant-1' }),
      row('other-tenant', { serverTimeMs: 1020, audience: 'TENANT', tenantId: 'tenant-2' }),
      row('mine', { serverTimeMs: 1030, audience: 'USER', userId: 'u1' }),
      row('other-user', { serverTimeMs: 1040, audience: 'USER', userId: 'u9' }),
      row('in-my-batch', { serverTimeMs: 1050, audience: 'USERS', userIds: ['u7', 'u1'] }),
      row('not-my-batch', { serverTimeMs: 1060, audience: 'USERS', userIds: ['u7', 'u8'] }),
    ]);
    liveFeedService.setStoreForTesting(fake.store);

    const result = await liveFeedService.read(scope, 0);

    assert.equal(result.source, 'firestore');
    assert.deepEqual(
      result.events.map((event) => event.id),
      ['all', 'my-tenant', 'mine', 'in-my-batch'],
    );
    assert.equal(result.readsCharged, 4);
  });

  it('sorts ascending and clamps the page size', async () => {
    setEnv({ LIVE_FEED_MAX_LIMIT: 2 });
    const fake = fakeStore([
      row('c', { serverTimeMs: 3000 }),
      row('a', { serverTimeMs: 1000 }),
      row('b', { serverTimeMs: 2000 }),
    ]);
    liveFeedService.setStoreForTesting(fake.store);

    const result = await liveFeedService.read(scope, 0, 99);

    assert.deepEqual(
      result.events.map((event) => event.id),
      ['a', 'b'],
    );
    assert.equal(result.nextCursorMs, 2000);
  });
});

describe('live feed — cursor', () => {
  before(async () => {
    const feed = await import('../src/services/liveFeed.service.js');
    liveFeedService = feed.liveFeedService;
    env = (await import('../src/config/env.js')).env;
  });

  beforeEach(() => {
    liveFeedService.setBudgetStoreForTesting({ read: async () => 0, charge: async () => {} });
    setEnv({
      LIVE_FEED_ENABLED: 'true',
      LIVE_FEED_MAX_LIMIT: 50,
      LIVE_FEED_DEFAULT_LIMIT: 25,
      LIVE_FEED_MONTHLY_READ_BUDGET: 500_000,
    });
  });

  it('excludes anything at or before the cursor and advances to the newest event', async () => {
    const fake = fakeStore([
      row('old', { serverTimeMs: 1000 }),
      row('edge', { serverTimeMs: 2000 }),
      row('new', { serverTimeMs: 3000 }),
    ]);
    liveFeedService.setStoreForTesting(fake.store);

    const result = await liveFeedService.read(scope, 2000);

    assert.deepEqual(
      result.events.map((event) => event.id),
      ['new'],
    );
    assert.equal(result.nextCursorMs, 3000);
  });

  it('keeps the cursor still when there is nothing new', async () => {
    const fake = fakeStore([row('old', { serverTimeMs: 1000 })]);
    liveFeedService.setStoreForTesting(fake.store);

    const result = await liveFeedService.read(scope, 5000);

    assert.deepEqual(result.events, []);
    assert.equal(result.nextCursorMs, 5000);
  });
});

describe('live feed — read budget', () => {
  before(async () => {
    const feed = await import('../src/services/liveFeed.service.js');
    liveFeedService = feed.liveFeedService;
    env = (await import('../src/config/env.js')).env;
  });

  beforeEach(() => {
    liveFeedService.setBudgetStoreForTesting({ read: async () => 0, charge: async () => {} });
    setEnv({
      LIVE_FEED_ENABLED: 'true',
      LIVE_FEED_MAX_LIMIT: 50,
      LIVE_FEED_DEFAULT_LIMIT: 25,
      LIVE_FEED_MONTHLY_READ_BUDGET: 10,
    });
  });

  it('refuses to spend a single read once the monthly budget is gone', async () => {
    const fake = fakeStore([row('a', { serverTimeMs: 1000 })]);
    liveFeedService.setStoreForTesting(fake.store);
    liveFeedService.setBudgetStoreForTesting({ read: async () => 10, charge: async () => {} });

    const result = await liveFeedService.read(scope, 0);

    assert.equal(result.source, 'budget_exhausted');
    assert.deepEqual(result.events, []);
    assert.equal(fake.stats.collectionCalls, 0, 'Firestore must not be queried');
    assert.equal(result.budget.remaining, 0);
  });

  it('charges exactly the documents returned', async () => {
    const fake = fakeStore([
      row('all', { serverTimeMs: 1000, audience: 'ALL' }),
      row('mine', { serverTimeMs: 1010, audience: 'USER', userId: 'u1' }),
    ]);
    liveFeedService.setStoreForTesting(fake.store);

    const charged: number[] = [];
    liveFeedService.setBudgetStoreForTesting({
      read: async () => 0,
      charge: async (_tenantId, reads) => {
        charged.push(reads);
      },
    });

    const result = await liveFeedService.read(scope, 0);

    assert.deepEqual(charged, [2]);
    assert.equal(result.readsCharged, 2);
    assert.equal(result.budget.used, 2);
    assert.equal(result.budget.remaining, 8);
  });
});

describe('live feed — degradation', () => {
  before(async () => {
    const feed = await import('../src/services/liveFeed.service.js');
    liveFeedService = feed.liveFeedService;
    env = (await import('../src/config/env.js')).env;
  });

  beforeEach(() => {
    liveFeedService.setBudgetStoreForTesting({ read: async () => 0, charge: async () => {} });
    setEnv({
      LIVE_FEED_ENABLED: 'true',
      LIVE_FEED_MAX_LIMIT: 50,
      LIVE_FEED_DEFAULT_LIMIT: 25,
      LIVE_FEED_MONTHLY_READ_BUDGET: 500_000,
    });
  });

  it('returns source "error" when Firestore throws, without throwing itself', async () => {
    liveFeedService.setStoreForTesting({
      collection() {
        throw new Error('firestore unavailable');
      },
    });

    const result = await mustResolve(() => liveFeedService.read(scope, 0));

    assert.equal(result.source, 'error');
    assert.deepEqual(result.events, []);
  });

  it('returns source "disabled" when no store can be resolved', async () => {
    liveFeedService.setStoreForTesting(null);
    setEnv({ FIREBASE_LIVE_MIRROR: 'false' });

    const result = await liveFeedService.read(scope, 0);
    assert.equal(result.source, 'disabled');
  });

  it('budget() reports spend without querying Firestore', async () => {
    liveFeedService.setBudgetStoreForTesting({ read: async () => 42, charge: async () => {} });
    const budget = await liveFeedService.budget('tenant-1');
    assert.equal(budget.used, 42);
    assert.equal(budget.remaining, 500_000 - 42);
  });
});
