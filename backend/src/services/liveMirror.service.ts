import { env } from '../config/env.js';
import { getFirebaseApp } from './firebase.service.js';

/**
 * Firestore live mirror (Phase 1 — see plan/firebase-migration/PHASE-1-LIVE-MIRROR.md).
 *
 * Copies every event the WebSocket gateway already fans out into Firestore, so a
 * client can `onSnapshot()` the `live_events` collection and get the same updates
 * even when its socket is closed (backgrounded app, cold start, flaky network).
 *
 * Design rules — these are the reason this file is safe to run next to the money code:
 *
 *  1. OFF by default. `FIREBASE_LIVE_MIRROR=false` (the default) makes every public
 *     method a no-op, so gateway behaviour is byte-identical to before this file existed.
 *  2. NEVER throws and never returns a rejected promise to a caller. Every SDK call is
 *     wrapped; a Firestore outage produces a rate-limited warning, never a 500.
 *  3. NEVER awaited on a request path. `publish()` only appends to an in-memory queue.
 *     Socket and HTTP latency are untouched.
 *  4. Bounded queue. Past `FIREBASE_LIVE_MIRROR_MAX_QUEUE` new events are dropped and
 *     counted, so an outage can never grow the heap or OOM a small instance.
 *  5. No retries. Live events are ephemeral: replaying a batch after a 30s outage would
 *     deliver stale state and multiply load during an incident. Failures are counted.
 *  6. No credentials → disabled with one startup log line, not a crash.
 */

/** Who the event was aimed at. Mirrors the four gateway fan-out methods. */
export type LiveMirrorAudience = 'ALL' | 'TENANT' | 'USER' | 'USERS';

export interface LiveMirrorScope {
  audience: LiveMirrorAudience;
  /** Present when every member of one tenant should receive the event. */
  tenantId?: string;
  /** Present for a single-player event. */
  userId?: string;
  /** Present for a targeted multi-player event (prize batches, admin actions). */
  userIds?: string[];
}

/** The payload shape the gateway already builds (see realtime.service.ts). */
export interface LiveMirrorEvent {
  type: string;
  data: unknown;
  timestamp: string;
  serverTimeMs?: number;
  serverTimeIst?: string;
}

export interface LiveMirrorDoc {
  data: Record<string, unknown>;
}

/** A sink writes one batch. Throwing is allowed — the caller catches and counts it. */
export type LiveMirrorSink = (docs: LiveMirrorDoc[]) => Promise<void>;

export interface LiveMirrorStats {
  enabled: boolean;
  queued: number;
  written: number;
  dropped: number;
  failedBatches: number;
  /** Events currently waiting in the queue. */
  pending: number;
}

/** How long the queue may sit before it is flushed. Keeps the feed feeling live. */
export const FLUSH_INTERVAL_MS = 250;

/** Firestore rejects `undefined` values and documents over ~1 MiB. */
const MAX_FIELD_STRING = 32_000;
const MAX_ARRAY_ITEMS = 500;
const MAX_DEPTH = 12;

/** Marker used internally so a nested `undefined` can be stripped before the write. */
const SKIP = Symbol('skip');

/** Deep-copies a value into something Firestore can actually store. */
function toFirestoreSafe(value: unknown, depth = 0): unknown | typeof SKIP {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return SKIP;
  }
  if (value === null) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    return value.length > MAX_FIELD_STRING ? `${value.slice(0, MAX_FIELD_STRING)}…[truncated]` : value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean' || typeof value === 'bigint') return value as unknown;

  if (depth >= MAX_DEPTH) return null;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
      const safe = toFirestoreSafe(item, depth + 1);
      if (safe !== SKIP) out.push(safe);
    }
    return out;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const safe = toFirestoreSafe(item, depth + 1);
      if (safe !== SKIP) out[key] = safe;
    }
    return out;
  }

  return String(value);
}

class LiveMirrorService {
  private enabled = false;
  private configured = false;

  private queue: LiveMirrorDoc[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  private collection = 'live_events';
  private maxQueue = 500;
  private maxBatch = 100;
  private ttlMs = 24 * 60 * 60 * 1000;

  private sink: LiveMirrorSink | null = null;
  private injectedSink: LiveMirrorSink | null = null;
  private sinkFactoryTried = false;

  private queued = 0;
  private written = 0;
  private dropped = 0;
  private failedBatches = 0;

  private lastWarnAt = 0;
  private suppressedWarnings = 0;

  /**
   * Reads configuration and starts the mirror. Safe to call when disabled or when
   * Firebase is unreachable — it only decides whether `publish()` does anything.
   */
  public init(): void {
    if (this.configured) return;
    this.configured = true;

    this.collection = env.FIREBASE_LIVE_MIRROR_COLLECTION;
    this.maxQueue = env.FIREBASE_LIVE_MIRROR_MAX_QUEUE;
    this.maxBatch = env.FIREBASE_LIVE_MIRROR_BATCH_SIZE;
    this.ttlMs = env.FIREBASE_LIVE_MIRROR_TTL_HOURS * 60 * 60 * 1000;

    if (env.FIREBASE_LIVE_MIRROR !== 'true') {
      this.enabled = false;
      return;
    }

    // A project id alone cannot write to Firestore — a service account is required.
    if (!env.FCM_CREDENTIALS_JSON) {
      this.enabled = false;
      console.warn(
        '⚠️  FIREBASE_LIVE_MIRROR=true but FCM_CREDENTIALS_JSON is missing — live mirror stays OFF.\n' +
          '    Firestore writes need a service account, not just a project id.',
      );
      return;
    }

    this.enabled = true;
    console.log(
      `🔥 Firestore live mirror ON → collection "${this.collection}" ` +
        `(batch ${this.maxBatch}, queue ${this.maxQueue})`,
    );
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /** Queue one event. Fire-and-forget: never blocks, never throws. */
  public publish(event: LiveMirrorEvent, scope: LiveMirrorScope): void {
    if (!this.enabled) return;

    try {
      if (this.queue.length >= this.maxQueue) {
        this.dropped += 1;
        this.warn('queue full — dropping live event', undefined);
        return;
      }
      this.queue.push({ data: this.buildDoc(event, scope) });
      this.queued += 1;
      this.schedule();
    } catch (err) {
      this.dropped += 1;
      this.warn('failed to queue live event', err);
    }
  }

  /** Flush everything waiting, oldest first. Never throws. */
  public async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.flushing = true;
    const batch = this.queue.splice(0, this.maxBatch);

    try {
      const sink = await this.resolveSink();
      if (!sink) {
        this.dropped += batch.length;
        this.enabled = false;
        console.warn('⚠️  Firestore live mirror disabled: no usable Firestore credentials.');
        return;
      }
      await sink(batch);
      this.written += batch.length;
    } catch (err) {
      // No retry by design (see the header). Stale live events are worse than none.
      this.failedBatches += 1;
      this.dropped += batch.length;
      this.warn('Firestore batch write failed', err);
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) this.schedule();
    }
  }

  /** Flush best-effort and stop. Called from the server's graceful shutdown. */
  public async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.enabled = false;
    await this.flush();
    this.sink = null;
    this.sinkFactoryTried = false;
  }

  public stats(): LiveMirrorStats {
    return {
      enabled: this.enabled,
      queued: this.queued,
      written: this.written,
      dropped: this.dropped,
      failedBatches: this.failedBatches,
      pending: this.queue.length,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private buildDoc(event: LiveMirrorEvent, scope: LiveMirrorScope): Record<string, unknown> {
    const now = Date.now();
    const serverTimeMs = typeof event.serverTimeMs === 'number' ? event.serverTimeMs : now;

    const payload = toFirestoreSafe(event.data ?? {});
    const doc: Record<string, unknown> = {
      type: event.type,
      data: payload === SKIP ? {} : payload,
      audience: scope.audience,
      timestamp: event.timestamp || new Date(serverTimeMs).toISOString(),
      serverTimeMs,
      serverTimeIst: event.serverTimeIst ?? null,
      createdAt: new Date(serverTimeMs),
    };

    if (scope.tenantId) doc.tenantId = scope.tenantId;
    if (scope.userId) doc.userId = scope.userId;
    if (scope.userIds && scope.userIds.length > 0) {
      doc.userIds = scope.userIds.slice(0, MAX_ARRAY_ITEMS);
    }
    if (this.ttlMs > 0) doc.expireAt = new Date(now + this.ttlMs);

    return doc;
  }

  private schedule(): void {
    if (this.timer || this.flushing) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    // Do not keep the event loop alive just for a pending mirror flush.
    this.timer.unref?.();
  }

  private async resolveSink(): Promise<LiveMirrorSink | null> {
    if (this.injectedSink) return this.injectedSink;
    if (this.sink) return this.sink;
    if (this.sinkFactoryTried) return null;
    this.sinkFactoryTried = true;

    try {
      const app = getFirebaseApp();
      if (!app || !env.FCM_CREDENTIALS_JSON) return null;

      const { getFirestore } = await import('firebase-admin/firestore');
      const db = getFirestore(app);
      const collection = this.collection;

      this.sink = async (docs: LiveMirrorDoc[]): Promise<void> => {
        const batch = db.batch();
        for (const doc of docs) {
          batch.set(db.collection(collection).doc(), doc.data);
        }
        await batch.commit();
      };
      return this.sink;
    } catch (err) {
      this.warn('could not initialise Firestore client', err);
      return null;
    }
  }

  /** Rate-limited warning so an outage cannot flood the logs. */
  private warn(message: string, err: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnAt < 60_000) {
      this.suppressedWarnings += 1;
      return;
    }
    this.lastWarnAt = now;
    const suppressed = this.suppressedWarnings;
    this.suppressedWarnings = 0;
    const detail = err instanceof Error ? ` — ${err.message}` : '';
    console.warn(
      `[liveMirror] ${message}${detail}` +
        (suppressed > 0 ? ` (${suppressed} similar warning(s) suppressed in the last minute)` : ''),
    );
  }

  // ─── Test seam (not used in production paths) ──────────────────────────

  /** Replace the Firestore writer with an in-memory stub for tests. */
  public setSinkForTesting(sink: LiveMirrorSink | null): void {
    this.injectedSink = sink;
  }

  /**
   * Reset all state so a test can exercise a fresh instance.
   *
   * `enabled` defaults to `true` (tests usually want the active path) and the
   * real SDK factory is permanently disabled so no test ever touches Firestore.
   */
  public resetForTesting(
    overrides: {
      enabled?: boolean;
      maxQueue?: number;
      maxBatch?: number;
      ttlMs?: number;
      collection?: string;
    } = {},
  ): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.flushing = false;
    this.enabled = overrides.enabled ?? true;
    this.configured = true;
    this.collection = overrides.collection ?? 'live_events';
    this.maxQueue = overrides.maxQueue ?? 500;
    this.maxBatch = overrides.maxBatch ?? 100;
    this.ttlMs = overrides.ttlMs ?? 24 * 60 * 60 * 1000;
    this.sink = null;
    this.injectedSink = null;
    this.sinkFactoryTried = true; // never touch the real SDK from a test
    this.queued = 0;
    this.written = 0;
    this.dropped = 0;
    this.failedBatches = 0;
    this.lastWarnAt = 0;
    this.suppressedWarnings = 0;
  }
}

export const liveMirrorService = new LiveMirrorService();

export { toFirestoreSafe };
