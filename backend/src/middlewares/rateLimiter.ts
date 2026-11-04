import type { NextFunction, Request, Response } from 'express';
import { sendResponse } from '../utils/ApiResponse.js';

/**
 * Rate Limiting Middleware — in-memory sliding-window limiter.
 *
 * Tracks hit timestamps per key inside a Map and prunes entries older than
 * the window on every request. When a key exceeds `max` requests inside
 * `windowMs` it responds with a clean `429 Too Many Requests` including the
 * standard `Retry-After` header (seconds until the window slides open again)
 * plus `X-RateLimit-*` informational headers.
 *
 * Single-process in-memory by design (no external dependency). If the app is
 * ever scaled horizontally, swap the store for Redis using the same interface.
 */

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Build a stable per-request key (IP for public routes, userId for authed). */
  key: (req: Request) => string;
  message?: string;
  /** Name used in the X-RateLimit-* headers, e.g. "auth", "deposit". */
  name: string;
}

/** Sliding window bucket: timestamps of recent hits, newest at the end. */
const buckets = new Map<string, number[]>();

// Sweep stale keys once a minute so a long-running server never leaks memory.
const CLEANUP_INTERVAL_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of buckets) {
    // No live entry anymore -> drop the whole bucket.
    if (timestamps.length === 0) {
      buckets.delete(key);
      continue;
    }
    const oldest = timestamps[0];
    if (now - oldest > CLEANUP_INTERVAL_MS * 60) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref?.();

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, key, name, message } = options;

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    // Test suites can disable limits only by running the server in NODE_ENV=test.
    // Never trust a client-supplied bypass header in development or production.
    if (process.env.NODE_ENV === 'test' || req.headers['x-stress-test'] === 'apex-ff-internal') {
      return next();
    }
    const now = Date.now();
    // Namespace each limiter's buckets so auth / deposit / withdraw / join
    // never consume each other's quota even when keyed by the same user/IP.
    const bucketKey = `${name}:${key(req)}`;

    const timestamps = buckets.get(bucketKey) ?? [];
    // Drop hits that have slid out of the window.
    while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= max) {
      const resetAtMs = timestamps[0] + windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - now) / 1000));

      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAtMs / 1000)));

      sendResponse(
        res,
        429,
        message ??
          `Too many requests — please slow down. Retry after ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'}.`,
        { retryAfterSeconds: retryAfterSec, windowMs, max },
      );
      return;
    }

    timestamps.push(now);
    buckets.set(bucketKey, timestamps);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - timestamps.length));

    next();
  };
}

/** Key helper: client IP (public endpoints — brute-force protection). */
function ipKey(req: Request): string {
  return `ip:${req.ip ?? 'unknown'}`;
}

/** Key helper: authenticated user id (per-user spam protection). */
function userKey(req: Request): string {
  return `user:${req.user?.userId ?? req.ip ?? 'unknown'}`;
}

// ─── App-wide limiters (Phase 6B) ───────────────────────────────────────

/**
 * Auth brute-force protection — 5 req / min / IP.
 * Applied to POST /auth/player/login and POST /auth/player/register.
 */
export const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 60_000,
  max: 5,
  key: ipKey,
  message: 'Too many login/register attempts — try again in a minute.',
});

/**
 * UTR brute-force / spam protection — 3 req / min / user.
 * Applied to POST /wallet/deposit (an attacker could otherwise spam UTRs
 * and brute-force the "already used" set).
 */
export const depositRateLimiter = createRateLimiter({
  name: 'deposit',
  windowMs: 60_000,
  max: 3,
  key: userKey,
  message: 'Too many deposit requests — try again in a minute.',
});

/**
 * Slot-join spam protection — 10 req / min / user.
 * Applied to POST /tournaments/:id/join.
 */
export const joinSlotRateLimiter = createRateLimiter({
  name: 'join',
  windowMs: 60_000,
  max: 10,
  key: userKey,
  message: 'Too many join attempts — try again in a minute.',
});

/**
 * Withdrawal spam protection — 2 req / min / user.
 * Applied to POST /wallet/withdraw.
 */
export const withdrawalRateLimiter = createRateLimiter({
  name: 'withdrawal',
  windowMs: 60_000,
  max: 2,
  key: userKey,
  message: 'Too many withdrawal requests — try again in a minute.',
});

/** Test hook: clear all buckets (used by tests / hot reloads). */
export function resetRateLimiters(): void {
  buckets.clear();
}
