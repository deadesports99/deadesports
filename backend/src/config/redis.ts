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
    // Never give up: a Redis instance that restarts (or is still booting on a
    // deploy) must reconnect on its own instead of leaving the process with a
    // permanently dead client. Backoff caps at 30s so a long outage stays cheap.
    return Math.min(30_000, 500 * 2 ** (times - 1));
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

/**
 * Open the Redis connection during boot instead of on the first command.
 *
 * The client is created with `lazyConnect: true`, which means "connecting" only
 * starts when the first command is issued — and that command then fails
 * immediately with `Stream isn't writeable` while the handshake is still in
 * flight. That made the first /health/redis probe after every deploy return 503.
 *
 * Never throws: Redis is an optional acceleration layer, so a boot with Redis
 * down must still serve traffic (the caller logs and continues).
 */
export function connectRedis(): void {
  if (redis.status === 'ready' || redis.status === 'connecting' || redis.status === 'connect') {
    return;
  }
  try {
    redis.connect().catch((err: Error) => {
      console.warn('[Redis] Initial connect failed:', err.message);
    });
  } catch (err) {
    console.warn('[Redis] Initial connect failed:', (err as Error).message);
  }
}

/**
 * Wait (briefly) for an in-flight connection handshake to finish.
 *
 * A health probe that arrives while ioredis is still in `connecting` must not
 * report a false outage: the handshake itself takes a few milliseconds on a
 * healthy host. Returns true once the client is `ready`, false on timeout.
 */
export async function waitForRedisReady(timeoutMs = 1_500): Promise<boolean> {
  if (redis.status === 'ready') return true;
  if (redis.status === 'end') return false;

  return new Promise<boolean>((resolve) => {
    const onReady = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      redis.off('ready', onReady);
      resolve(redis.status === 'ready');
    }, timeoutMs);
    redis.once('ready', onReady);
  });
}

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
