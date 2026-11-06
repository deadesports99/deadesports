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

  // ─── Online payment gateway (wallet top-up) ───────────────────────────
  /** `mock` = no keys needed (demo), `razorpay` = real Indian gateway. */
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),

  /** Razorpay API key id (`rzp_test_*` / `rzp_live_*`). */
  RAZORPAY_KEY_ID: z.string().optional(),

  /** Razorpay API key secret — also used as the mock HMAC secret. */
  RAZORPAY_KEY_SECRET: z.string().optional(),

  /** Razorpay webhook signing secret (dashboard -> Webhooks). */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /**
   * Razorpay REST base. Overridable so integration tests can run against a local
   * stub and so a corporate proxy can be inserted. Defaults to the real API.
   */
  RAZORPAY_API_BASE_URL: z.string().url().default('https://api.razorpay.com/v1'),

  /** Minimum top-up in paise (default ₹10). */
  PAYMENT_MIN_AMOUNT_PAISE: z.coerce.number().int().positive().default(1_000),

  /** Maximum top-up in paise (default ₹10,000). */
  PAYMENT_MAX_AMOUNT_PAISE: z.coerce.number().int().positive().default(1_000_000),

  /** How long a checkout order stays payable (default 15 min). */
  PAYMENT_ORDER_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  /** Mock mode: auto-credit on "Pay now" (true) or leave PENDING (false). */
  PAYMENT_MOCK_AUTO_CAPTURE: z
    .string()
    .default('true')
    .transform((value) => value === 'true' || value === '1'),

  /** Sweep interval that expires stale CREATED/PENDING orders (default 5 min). */
  PAYMENT_EXPIRY_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  /**
   * Auto-reconcile sweep: ask the gateway about stale unpaid orders. `0` disables
   * the sweep (useful for hosts that reconcile externally or during incidents).
   */
  PAYMENT_RECONCILE_SWEEP_INTERVAL_MS: z.coerce.number().int().nonnegative().default(300_000),

  /** Public HTTPS base URL used for checkout callbacks / demo links. */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5000'),
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
