import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { getFirebaseApp } from './firebase.service.js';

/**
 * Live feed reader (Phase 2 — plan/firebase-migration/PHASE-2-LIVE-READER.md).
 *
 * Phase 1 mirrors every websocket event into Firestore. A socket that was closed
 * (app backgrounded, dead network, cold start) therefore missed events. This
 * service lets the app ask for the gap: "give me everything after cursor X".
 *
 * Why the backend reads Firestore instead of the client SDK:
 *
 *  1. **Authorisation.** The scope filter (my tenant, my user id) is computed from
 *     the verified JWT, not from anything the client sends. A player cannot ask for
 *     another tenant's events even if it rewrites the query.
 *  2. **Cost control.** Firestore bills per document read, and a client-side
 *     `onSnapshot` loop is invisible to us. Every read here is metered against a
 *     per-tenant monthly budget, and the endpoint pauses itself when it runs out.
 *  3. **No Firebase Auth dependency.** Our players authenticate with our own JWT;
 *     mapping them onto Firebase custom claims just for read rules is unnecessary work.
 *  4. **Graceful degradation.** Firestore down, mirror never enabled, Redis down —
 *     all three return a well-formed empty answer, never a 500. The websocket
 *     remains the primary channel either way.
 */

export interface LiveFeedScope {
  userId: string;
  tenantId: string;
}

export type LiveFeedSource = 'firestore' | 'disabled' | 'budget_exhausted' | 'error';

export interface LiveFeedEvent {
  id: string;
  type: string;
  data: unknown;
  audience: string;
  timestamp: string;
  serverTimeMs: number;
}

export interface LiveFeedBudget {
  monthlyLimit: number;
  used: number;
  remaining: number;
}

export interface LiveFeedResult {
  source: LiveFeedSource;
  enabled: boolean;
  events: LiveFeedEvent[];
  /** Pass back as `?since=` on the next call. Always >= the requested cursor. */
  nextCursorMs: number;
  /** Firestore documents this call is billed for. */
  readsCharged: number;
  budget: LiveFeedBudget;
}

/** Audience values written by the Phase 1 mirror. */
const AUDIENCE = {
  ALL: 'ALL',
  TENANT: 'TENANT',
  USER: 'USER',
  USERS: 'USERS',
} as const;

/** Redis key for the per-tenant monthly counter, e.g. ff:livefeed:2026-02:<tenant>. */
function budgetKey(tenantId: string, now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `ff:livefeed:${month}:${tenantId}`;
}

/** Counter used when Redis is unreachable, so one bad tenant cannot slip past. */
const memoryBudget = new Map<string, number>();

async function readUsage(tenantId: string): Promise<number> {
  const key = budgetKey(tenantId);
  try {
    const raw = await redis.get(key);
    const value = Number(raw ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return memoryBudget.get(key) ?? 0;
  }
}

async function chargeUsage(tenantId: string, reads: number): Promise<void> {
  if (reads <= 0) return;
  const key = budgetKey(tenantId);
  try {
    await redis.incrby(key, reads);
    // Month buckets are self-expiring anyway; the TTL just keeps Redis tidy.
    await redis.expire(key, 40 * 24 * 60 * 60);
  } catch {
    memoryBudget.set(key, (memoryBudget.get(key) ?? 0) + reads);
  }
}

function clampLimit(requested: number): number {
  const max = env.LIVE_FEED_MAX_LIMIT;
  if (!Number.isFinite(requested) || requested <= 0) {
    return Math.min(env.LIVE_FEED_DEFAULT_LIMIT, max);
  }
  return Math.min(Math.floor(requested), max);
}

/**
 * Firestore client, resolved once. Returns null when there is nothing usable —
 * no service account, mirror never enabled, or the SDK failed to load.
 */
let db: any = null;
let dbResolved = false;

async function resolveDb(): Promise<any | null> {
  if (dbResolved) return db;
  dbResolved = true;

  try {
    if (env.FIREBASE_LIVE_MIRROR !== 'true' || !env.FCM_CREDENTIALS_JSON) return null;
    const app = getFirebaseApp();
    if (!app) return null;
    const { getFirestore } = await import('firebase-admin/firestore');
    db = getFirestore(app);
    return db;
  } catch (err) {
    console.warn('[liveFeed] Firestore client unavailable:', (err as Error).message);
    return null;
  }
}

/** One query per audience kind — Firestore has no cheap cross-field OR. */
function buildQueries(
  store: any,
  scope: LiveFeedScope,
  sinceMs: number,
  limit: number,
): any[] {
  const collection = () => store.collection(env.FIREBASE_LIVE_MIRROR_COLLECTION);
  const fresh = (q: any) => q.where('serverTimeMs', '>', sinceMs).orderBy('serverTimeMs').limit(limit);

  return [
    fresh(collection().where('audience', '==', AUDIENCE.ALL)),
    fresh(
      collection()
        .where('audience', '==', AUDIENCE.TENANT)
        .where('tenantId', '==', scope.tenantId),
    ),
    fresh(collection().where('audience', '==', AUDIENCE.USER).where('userId', '==', scope.userId)),
    fresh(
      collection()
        .where('audience', '==', AUDIENCE.USERS)
        .where('userIds', 'array-contains', scope.userId)
        .where('serverTimeMs', '>', sinceMs)
        .orderBy('serverTimeMs')
        .limit(limit),
    ),
  ];
}

function toEvent(snapshot: any): LiveFeedEvent {
  const doc = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    type: String(doc.type ?? 'UNKNOWN'),
    data: doc.data ?? {},
    audience: String(doc.audience ?? AUDIENCE.ALL),
    timestamp: String(doc.timestamp ?? new Date(Number(doc.serverTimeMs ?? 0)).toISOString()),
    serverTimeMs: Number(doc.serverTimeMs ?? 0),
  };
}

class LiveFeedService {
  /**
   * Read the events this user is allowed to see, newer than `sinceMs`.
   *
   * Never throws. Every failure mode is reported through `source` so the caller
   * (and therefore the client) can fall back to the websocket instead of showing
   * an error screen.
   */
  public async read(
    scope: LiveFeedScope,
    sinceMs: number,
    requestedLimit?: number,
  ): Promise<LiveFeedResult> {
    const limit = clampLimit(requestedLimit ?? env.LIVE_FEED_DEFAULT_LIMIT);
    const cursor = Number.isFinite(sinceMs) && sinceMs > 0 ? Math.floor(sinceMs) : 0;
    const monthlyLimit = env.LIVE_FEED_MONTHLY_READ_BUDGET;

    const used = await this.usage(scope.tenantId);
    const budget: LiveFeedBudget = {
      monthlyLimit,
      used,
      remaining: Math.max(0, monthlyLimit - used),
    };

    const empty = (source: LiveFeedSource, readsCharged = 0): LiveFeedResult => ({
      source,
      enabled: env.LIVE_FEED_ENABLED === 'true',
      events: [],
      nextCursorMs: cursor,
      readsCharged,
      budget,
    });

    if (env.LIVE_FEED_ENABLED !== 'true') return empty('disabled');
    if (used >= monthlyLimit) return empty('budget_exhausted');

    try {
      const store = await this.resolveStore();
      if (!store) return empty('disabled');

      const results = await Promise.all(buildQueries(store, scope, cursor, limit).map((q) => q.get()));

      const byId = new Map<string, LiveFeedEvent>();
      let reads = 0;
      for (const result of results) {
        for (const snapshot of result.docs) {
          reads += 1;
          // A document can only match one audience query, but dedupe anyway.
          if (!byId.has(snapshot.id)) byId.set(snapshot.id, toEvent(snapshot));
        }
      }

      const events = [...byId.values()]
        .sort((a, b) => a.serverTimeMs - b.serverTimeMs)
        .slice(0, limit);

      await this.spend(scope.tenantId, reads);

      // Advance the cursor to the newest event actually returned, so the next call
      // starts where this one stopped (events beyond `limit` are re-served by design).
      const newest = events.length > 0 ? events[events.length - 1]!.serverTimeMs : cursor;

      return {
        source: 'firestore',
        enabled: true,
        events,
        nextCursorMs: newest,
        readsCharged: reads,
        budget: {
          monthlyLimit,
          used: used + reads,
          remaining: Math.max(0, monthlyLimit - used - reads),
        },
      };
    } catch (err) {
      console.warn('[liveFeed] read failed:', (err as Error).message);
      return empty('error');
    }
  }

  /** Budget snapshot without spending a read. Used by ops/health checks. */
  public async budget(tenantId: string): Promise<LiveFeedBudget> {
    const used = await this.usage(tenantId);
    return {
      monthlyLimit: env.LIVE_FEED_MONTHLY_READ_BUDGET,
      used,
      remaining: Math.max(0, env.LIVE_FEED_MONTHLY_READ_BUDGET - used),
    };
  }

  // ─── Internals + test seams (seams are never used on production paths) ──

  private testStore: any | null = null;
  private testBudget: {
    read: (tenantId: string) => Promise<number>;
    charge: (tenantId: string, reads: number) => Promise<void>;
  } | null = null;

  private async resolveStore(): Promise<any | null> {
    if (this.testStore) return this.testStore;
    return resolveDb();
  }

  private async usage(tenantId: string): Promise<number> {
    return this.testBudget ? this.testBudget.read(tenantId) : readUsage(tenantId);
  }

  private async spend(tenantId: string, reads: number): Promise<void> {
    if (this.testBudget) return this.testBudget.charge(tenantId, reads);
    return chargeUsage(tenantId, reads);
  }

  /** Inject a fake Firestore `collection()` root. Pass null to reset. */
  public setStoreForTesting(store: any | null): void {
    this.testStore = store;
  }

  /** Replace the budget counter so tests never touch Redis. */
  public setBudgetStoreForTesting(
    store: {
      read: (tenantId: string) => Promise<number>;
      charge: (tenantId: string, reads: number) => Promise<void>;
    } | null,
  ): void {
    this.testBudget = store;
  }
}

export const liveFeedService = new LiveFeedService();
