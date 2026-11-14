import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

/**
 * Singleton PrismaClient wired to PostgreSQL through the pg driver adapter
 * (required since Prisma ORM 7 — the connection URL is not read from the
 * schema file anymore, it lives in prisma.config.ts for the CLI and here for
 * the runtime client).
 */
/**
 * pg v9 treats `sslmode=require` as `verify-full`, which overrides the explicit
 * `ssl` object below and breaks against Supabase's pooler (its chain contains a
 * managed/self-signed CA). We therefore keep TLS on via `ssl` and drop only the
 * URL flag — same intent as the original `rejectUnauthorized: false` config.
 */
function withoutSslMode(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

/**
 * Local Docker Postgres (localhost/127.0.0.1) has no TLS listener, so SSL is
 * only enabled for remote hosts (Supabase pooler etc.). Keeping it explicit
 * avoids `Error opening a TLS connection` in local development.
 */
function usesTls(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host);
  } catch {
    return true;
  }
}

const pool = new pg.Pool({
  connectionString: withoutSslMode(env.DATABASE_URL),
  ssl: usesTls(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  // Keep the application-side pool bounded for Supabase's PgBouncer pooler.
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
});

pool.on('error', (err) => {
  console.warn('[pg.Pool idle client error (auto-reconnected)]:', err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (event) => {
    console.log(`[Prisma Query] ${event.query} (${event.duration}ms)`);
  });
  prisma.$on('warn', (event) => {
    console.warn('[Prisma Warn]', event.message);
  });
}
prisma.$on('error', (event) => {
  console.error('[Prisma Error]', event.message);
});

/** Gracefully close the Prisma connection pool (used during server shutdown). */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
