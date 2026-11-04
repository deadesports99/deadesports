import Redis from 'ioredis';
import { env } from './env.js';

/**
 * Singleton Redis client.
 * Configured with enableOfflineQueue: false so if Redis is offline,
 * operations fail instantly in 0ms without queuing or hanging HTTP requests.
 */
export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 3_000,
  commandTimeout: 3_000,
  retryStrategy: (times: number): number | null => {
    if (times > 5) return null;
    return Math.min(2000, 500 * 2 ** (times - 1));
  },
});

redis.on('connect', () => console.log('[Redis] Connecting...'));
redis.on('ready', () => console.log('[Redis] Connected & ready ✔'));
redis.on('reconnecting', (delayMs: number) =>
  console.warn(`[Redis] Reconnecting in ${delayMs}ms...`),
);
redis.on('error', (err: Error) => {
  if (err.message !== 'Connection is closed.' && !err.message.includes('Stream isn\'t writeable')) {
    console.error('[Redis] Error:', err.message);
  }
});
redis.on('close', () => console.warn('[Redis] Connection closed'));

/** Gracefully close the Redis connection (used during server shutdown). */
export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'end') return;
  try {
    await redis.quit();
  } catch {
    // Redis is an optional acceleration layer; never block shutdown on it.
    redis.disconnect();
  }
}
