import 'dotenv/config';
import { z } from 'zod';

/** Development fallback — production boot refuses this exact value. */
const DEV_PEPPER = 'dev-only-insecure-pepper-change-me-0123456789';

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

  /** PostgreSQL connection string (local Docker, Supabase, or any managed Postgres). */
  DATABASE_URL: z.string().url(),

  /** Redis connection string (local or Upstash). */
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /** JWT signing secret — long enough for production signing. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),

  /** JWT token lifetime, e.g. "7d", "24h". */
  JWT_EXPIRES_IN: z.string().default('7d'),

  /** Admin-web session lifetime (httpOnly cookie). Shorter than player JWTs. */
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(72).default(12),

  /**
   * Exact admin-web origin allowed to send cookie-authenticated mutations.
   * Used for the CSRF Origin/Referer gate. Dev default: Vite on 5174.
   */
  ADMIN_WEB_ORIGIN: z.string().url().default('http://localhost:5174'),

  /**
   * Serve the built admin console (`admin-web/dist`) from this Express process.
   * Single-origin deploys (Render) need this so cookies + WebSockets just work.
   */
  SERVE_ADMIN_WEB: z
    .string()
    .default('false')
    .transform((value) => value === 'true' || value === '1'),

  /**
   * Folder holding the built admin console. Empty → `<cwd>/admin-web/dist`,
   * which is exactly where the full-stack Docker image copies it.
   */
  ADMIN_WEB_DIST: z.string().default(''),

  /** Email transport for admin OTPs. `smtp` still needs nodemailer — not wired. */
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend', 'brevo']).default('console'),

  /** Brevo transactional API key (free tier: 300 mails/day). */
  BREVO_API_KEY: z.string().default(''),

  /** Resend API key (free tier: 3000 mails/month) — fallback switch. */
  RESEND_API_KEY: z.string().default(''),

  /** Hard timeout for one provider call, so a hung request cannot block login. */
  EMAIL_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),

  /**
   * Rolling 24h cap of sign-in codes per identity. Protects the shared
   * provider quota (Brevo free = 300/day) from an authenticated loop.
   */
  ADMIN_OTP_DAILY_CAP: z.coerce.number().int().positive().max(500).default(10),

  /** From address shown to the owner ("Brand <no-reply@...>"). */
  EMAIL_FROM: z.string().default('Apex Free Fire Club <no-reply@apexff.com>'),

  /** Comma-separated list of allowed client origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /**
   * Secret pepper for admin/staff permission keys (24-char API-key style) and
   * hashed email OTPs. Must be 32+ chars. Production boot is refused while the
   * development default is still in place (see the guard below).
   */
  ACCESS_KEY_PEPPER: z
    .string()
    .min(32, 'ACCESS_KEY_PEPPER must be at least 32 characters long')
    .default(DEV_PEPPER),

  /** Reverse-proxy trust flag for Render/Caddy deployments. */
  TRUST_PROXY: z.string().default('false').transform((value) => value === 'true' || value === '1'),

  /** PostgreSQL pool sizing for managed Postgres / a connection pooler. */
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  /** Firebase service-account JSON (stringified) for FCM push. Optional — push disabled when absent. */
  FCM_CREDENTIALS_JSON: z.string().optional(),

  /** Firebase Project ID for public cert token verification. */
  FIREBASE_PROJECT_ID: z.string().default('deadesports-865d2'),

  /**
   * LOCAL DEVELOPMENT ONLY: accept `dev_otp_<phone>` / `dev_google_<uid>` tokens so
   * a phone can log in without Firebase credentials. Refused unless
   * NODE_ENV === 'development' **and** this is explicitly 'true'; booting production
   * with it set is fatal (see assertDevAuthConfig).
   */
  DEV_FAKE_FIREBASE: z.string().optional(),

  /**
   * Kill switch for Firebase Phone (SMS) OTP auth. `false` disables phone
   * signup/login for players (they fall back to Email OTP / Google).
   * Defaults to `true`; ADMIN / SUB_ADMIN logins stay unaffected.
   */
  PHONE_OTP_ENABLED: z.enum(['true', 'false']).default('true'),

  /**
   * ⚠️ DEMO ONLY. `true` accepts ANY 10-digit phone + ANY 6-digit OTP: the server
   * skips Firebase SMS verification and provisions the player account on first
   * login. Use while the Firebase phone provider is broken, then set back to `false`.
   */
  PHONE_OTP_BYPASS: z.enum(['true', 'false']).default('false'),

  // ─── Firebase live mirror (Phase 1, see plan/firebase-migration) ──────
  /**
   * Master switch for the Firestore live mirror. `true` copies every WebSocket
   * event into Firestore so clients can subscribe with the Firebase SDK.
   * OFF by default: with `false` the gateway behaves exactly as before.
   */
  FIREBASE_LIVE_MIRROR: z.enum(['true', 'false']).default('false'),

  /** Firestore collection that receives the mirrored events. */
  FIREBASE_LIVE_MIRROR_COLLECTION: z.string().default('live_events'),

  /**
   * Hours written into each document's `expireAt` field. Pair it with a
   * Firestore TTL policy on that field to keep the collection small. `0` = never expire.
   */
  FIREBASE_LIVE_MIRROR_TTL_HOURS: z.coerce.number().int().nonnegative().default(24),

  /** In-memory queue cap. Past this, events are dropped and counted (never OOM). */
  FIREBASE_LIVE_MIRROR_MAX_QUEUE: z.coerce.number().int().positive().max(100_000).default(500),

  /** Documents per Firestore batch write (Firestore hard limit is 500). */
  FIREBASE_LIVE_MIRROR_BATCH_SIZE: z.coerce.number().int().positive().max(400).default(100),

  // ─── Live feed reader (Phase 2, see plan/firebase-migration) ────────
  /**
   * Enables `GET /api/v1/live/events`, the catch-up feed a client calls after a
   * reconnect to collect what it missed. OFF by default: while off the endpoint
   * answers `source: "disabled"` and clients keep using the websocket alone.
   */
  LIVE_FEED_ENABLED: z.enum(['true', 'false']).default('false'),

  /** Hard cap on `?limit=` regardless of what a client asks for. */
  LIVE_FEED_MAX_LIMIT: z.coerce.number().int().positive().max(200).default(50),

  /** Page size used when the client does not send `?limit=`. */
  LIVE_FEED_DEFAULT_LIMIT: z.coerce.number().int().positive().max(200).default(25),

  /**
   * Firestore document reads allowed per tenant per calendar month across the whole
   * live feed. Past this the endpoint pauses itself (429 + Retry-After) instead of
   * letting a polling bug turn into a bill. This is the primary cost guardrail.
   */
  LIVE_FEED_MONTHLY_READ_BUDGET: z.coerce.number().int().nonnegative().default(500_000),

  // ─── Firebase Storage media uploads (Phase 4, see plan/firebase-migration) ──
  /**
   * Enables `POST /api/v1/media/upload` (tenant logos, banners, match screenshots).
   * OFF by default: while off the route answers 403 with a reason and every existing
   * "paste a URL" workflow keeps working untouched.
   */
  MEDIA_UPLOAD_ENABLED: z.enum(['true', 'false']).default('false'),

  /**
   * Storage bucket name. Empty = `<FIREBASE_PROJECT_ID>.firebasestorage.app`
   * (the current default). Older projects use `<projectId>.appspot.com` — set it
   * explicitly if uploads fail with "bucket does not exist".
   */
  FIREBASE_STORAGE_BUCKET: z.string().default(''),

  /** Hard ceiling per image. Default 5 MiB (logos/banners need far less). */
  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),

  // ─── Daily stats snapshot → Firestore (Phase 5, see plan/firebase-migration) ──
  /**
   * Nightly aggregate snapshot (counts + money totals per tenant per day).
   * OFF by default. The CLI (`npm run export:stats`) works regardless of this flag.
   */
  STATS_EXPORT_ENABLED: z.enum(['true', 'false']).default('false'),

  /** How often the in-process scheduler runs (hours). */
  STATS_EXPORT_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).default(24),

  /**
   * Rolling window recomputed on every run. >1 means a missed night heals itself
   * on the next run (writes are idempotent, keyed `<tenantId>_<YYYY-MM-DD>`).
   */
  STATS_EXPORT_DAYS: z.coerce.number().int().min(1).max(31).default(3),

  /** Firestore collection receiving the snapshots. */
  STATS_EXPORT_COLLECTION: z.string().default('stats'),

  /**
   * ⚠️ DEMO / LOCAL TESTING ONLY. Comma-separated IPs that skip every rate
   * limiter (auth, deposit, withdrawal, join). Ignored when NODE_ENV is
   * 'production', and booting production with it set is a startup warning.
   * Remove before launch — see plan/PRODUCTION_CLOUD_EXECUTION_PLAN.md §V3.
   */
  RATE_LIMIT_ALLOW_IPS: z.string().optional(),

  // ─── Online payment gateway (wallet top-up) ───────────────────────────
  /**
   * Master switch for online wallet top-up. `false` = the payment routes are
   * not mounted at all and no gateway keys are required, which is the correct
   * state while Razorpay KYC is pending. Wallet credits still happen through
   * the owner's manual UTR approval flow, so the panel is fully usable.
   */
  PAYMENTS_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value === 'true' || value === '1'),

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

// ─── Production-only safety guards ──────────────────────────────────────
if (env.NODE_ENV === 'production' && env.ACCESS_KEY_PEPPER === DEV_PEPPER) {
  console.error(
    '❌ ACCESS_KEY_PEPPER is still the development default. Set a unique 32+ character secret before running in production.',
  );
  process.exit(1);
}

export type Env = typeof env;
