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

  /** JWT signing secret — must be at least 10 characters. */
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters long'),

  /** JWT token lifetime, e.g. "7d", "24h". */
  JWT_EXPIRES_IN: z.string().default('7d'),

  /** Comma-separated list of allowed client origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /** Firebase service-account JSON (stringified) for FCM push. Optional — push disabled when absent. */
  FCM_CREDENTIALS_JSON: z.string().optional(),
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