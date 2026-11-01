import Redis from 'ioredis';
import { env } from './env.js';

/**
 * Singleton Redis client.
 * Used for the anti-overbooking slot lock (SETNX), caching and rate limiting
 * in later phases, so it is kept alive across the process lifetime.
 */
export const redis = new Redis(env.REDIS_URL, {
  // Keep retrying forever (ioredis by default stops after 20 attempts).
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Exponential backoff capped at 2000ms: 500ms, 1000ms, 2000ms, 2000ms, ...
  retryStrategy: (times: number): number => {
    const delay = Math.min(2000, 500 * 2 ** (times - 1));
    console.warn(`[Redis] Connection lost — retrying in ${delay}ms (attempt #${times})`);
    return delay;
  },
});

redis.on('connect', () => console.log('[Redis] Connecting...'));
redis.on('ready', () => console.log('[Redis] Connected & ready ✔'));
redis.on('reconnecting', (delayMs: number) =>
  console.warn(`[Redis] Reconnecting in ${delayMs}ms...`),
);
redis.on('error', (err: Error) => {
  // A closed connection also emits 'error'; do not spam the logs with it.
  if (err.message !== 'Connection is closed.') {
    console.error('[Redis] Error:', err.message);
  }
});
redis.on('close', () => console.warn('[Redis] Connection closed'));

/** Gracefully close the Redis connection (used during server shutdown). */
export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'end') return;
  await redis.quit();
}