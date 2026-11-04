import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod schema for ALL environment variables used by the application.
 * The process is terminated immediately with a descriptive error if any
 * required variable is missing or invalid — fail fast at startup.
 */
const envSchema = z.object({
  /** HTTP port the Express server listens on. */
  PORT: z.coerce.number().int().positive().default(5000),

  /** Runtime environment. */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Supabase / PostgreSQL connection string. */
  DATABASE_URL: z.string().url(),

  /** Redis connection string (local or Upstash). */
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /** JWT signing secret — long enough for production signing. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),

  /** JWT token lifetime, e.g. "7d", "24h". */
  JWT_EXPIRES_IN: z.string().default('7d'),

  /** Comma-separated list of allowed client origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /** Reverse-proxy trust flag for Render/Caddy deployments. */
  TRUST_PROXY: z.string().default('false').transform((value) => value === 'true' || value === '1'),

  /** PostgreSQL pool sizing for Supabase Pooler and managed Postgres. */
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  /** Firebase service-account JSON (stringified) for FCM push. Optional — push disabled when absent. */
  FCM_CREDENTIALS_JSON: z.string().optional(),

  /** Firebase Project ID for public cert token verification. */
  FIREBASE_PROJECT_ID: z.string().default('deadesports-865d2'),
});

/** Zod schema that transforms CORS_ORIGIN (CSV) into a clean string[]. */
const corsOriginSchema = envSchema.shape.CORS_ORIGIN.transform((value: string): string[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
);

const finalSchema = envSchema.extend({
  CORS_ORIGIN: corsOriginSchema,
});

const parsed = finalSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'ROOT'}: ${issue.message}`)
    .join('\n');
  console.error('❌ Invalid environment variables:\n' + formatted);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
