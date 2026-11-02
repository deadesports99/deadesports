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

const pool = new pg.Pool({
  connectionString: withoutSslMode(env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
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