import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { adminAuthRouter, adminAccessRouter } from './routes/adminAuth.routes.js';
import { adminWalletRouter } from './routes/adminWallet.routes.js';
import { stripTrailingSlashes } from './utils/strings.js';
import { healthRouter } from './routes/health.routes.js';
import { timeRouter } from './routes/time.routes.js';
import { liveRouter } from './routes/live.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { resultRouter } from './routes/result.routes.js';
import { tournamentRouter } from './routes/tournament.routes.js';
import { tenantRouter, adminTenantRouter } from './routes/tenant.routes.js';
import { playerRouter } from './routes/player.routes.js';
import { adminPlayerRouter } from './routes/adminPlayer.routes.js';
import { adminMatchRouter } from './routes/adminMatch.routes.js';
import { paymentConfig } from './config/payment.js';
import { paymentRouter } from './routes/payment.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { ApiError } from './utils/ApiError.js';

/** Express application — assembled here, listening happens in server.ts. */
const app = express();

// Cloud providers terminate TLS before forwarding to Node. Trust only the
// explicitly configured proxy in production so req.ip remains rate-limitable.
app.set('trust proxy', env.TRUST_PROXY);

// ─── 1. Security headers ────────────────────────────────────────────────
// CSP is tuned for the bundled admin console: same-origin bundle/API/WebSocket,
// Google Fonts, and data/blob images. Nothing else may load.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'script-src': ["'self'"],
      },
    },
  }),
);

// ─── 2. CORS — allow configured client origins (or wildcard for mobile APIs)
const allowAllOrigins = env.CORS_ORIGIN.includes('*');
app.use(
  cors({
    origin: allowAllOrigins ? true : env.CORS_ORIGIN,
    credentials: !allowAllOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Server-Time', 'X-Server-Time-IST'],
  }),
);

// ─── 3. Body parsers ────────────────────────────────────────────────────
// Payment webhooks MUST be verified against the exact raw bytes: re-serialising
// the parsed JSON changes whitespace/order and the HMAC would never match.
// We therefore stash `rawBody` for the two webhook paths only.
const WEBHOOK_PATHS = new Set(['/api/payments/webhook', '/api/v1/payments/webhook']);

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      const pathname = stripTrailingSlashes((req as Request).originalUrl.split('?')[0]);
      if (WEBHOOK_PATHS.has(pathname)) {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 4. Authoritative Server Time & Tamper-Proof Header Middleware ───────
// Injects exact server timestamp into every single HTTP response header.
// Client devices use this to defeat local clock spoofing.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Server-Time', Date.now().toString());
  res.setHeader('X-Server-Time-IST', new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString());
  next();
});

// ─── 5. Simple request logger (Sanitized to prevent Log Injection) ───────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const safeMethod = req.method.replace(/[\r\n]/g, '');
  const safeUrl = req.originalUrl.replace(/[\r\n]/g, '');
  const safeIp = (req.ip ?? 'unknown').replace(/[\r\n]/g, '');
  console.log(`[${new Date().toISOString()}] ${safeMethod} ${safeUrl} - IP: ${safeIp}`);
  next();
});

// ─── 5b. Admin console static build (single-origin deploys) ─────────────
// Render/Caddy deployments ship `admin-web/dist` inside the same image, so the
// UI, the API and the WebSocket gateway all live on one origin — cookies stay
// first-party and no `VITE_WS_URL` juggling is needed.
const adminWebDist = env.ADMIN_WEB_DIST
  ? path.resolve(env.ADMIN_WEB_DIST)
  : path.resolve(process.cwd(), 'admin-web', 'dist');
const adminWebIndex = path.join(adminWebDist, 'index.html');
const hasAdminBuild = fs.existsSync(adminWebIndex);
const serveAdminWeb = env.SERVE_ADMIN_WEB && hasAdminBuild;

if (env.SERVE_ADMIN_WEB && !hasAdminBuild) {
  console.warn(
    `[admin-web] SERVE_ADMIN_WEB=true but no build found at ${adminWebIndex} — API-only mode.`,
  );
}

if (serveAdminWeb) {
  // Vite hashes asset filenames → cache them hard; index.html must stay fresh.
  app.use(
    '/assets',
    express.static(path.join(adminWebDist, 'assets'), {
      index: false,
      immutable: true,
      maxAge: '365d',
    }),
  );
  app.use(express.static(adminWebDist, { index: false, maxAge: '1h', etag: true }));
  console.log(`[admin-web] serving console from ${adminWebDist}`);
}

// ─── 6. Routes ──────────────────────────────────────────────────────────
// Root info banner (nice for quick browser check). With the bundled console the
// root serves the UI instead, and the banner stays available under /api/v1.
app.get('/', (_req: Request, res: Response, next: NextFunction) => {
  if (serveAdminWeb) {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(adminWebIndex, (error) => (error ? next(error) : undefined));
    return;
  }
  res.status(200).json({
    name: 'Free Fire Tournament Platform API',
    version: '1.0.0',
    status: 'running',
    health: ['/health', '/api/v1/health'],
    time: ['/time', '/api/v1/time'],
  });
});

// Health routes mounted at both the root alias and the versioned namespace.
app.use(healthRouter);
app.use('/api/v1', healthRouter);

// Authoritative Indian Standard Time (IST) sync routes
app.use('/time', timeRouter);
app.use('/api/v1/time', timeRouter);

// Live feed catch-up for clients that missed websocket events (Phase 2).
// Anchored at /api/v1 only — this is an app endpoint, not a public banner.
app.use('/api/v1/live', liveRouter);

// Media uploads to Firebase Storage (Phase 4). Admin/staff only.
app.use('/api/v1/media', mediaRouter);

// Auth & RBAC
app.use('/api/v1/auth/admin', adminAuthRouter);
app.use('/api/v1/auth', authRouter);

// Tournament Engine (Phase 3)
app.use('/api/v1/tournaments', tournamentRouter);

// Room release + results + payout (Phase 4)
app.use('/api/v1/tournaments', resultRouter);

// Wallet: balances + double-entry ledger history (Android Phase 2)
app.use('/api/v1/wallet', walletRouter);

// Admin wallet console: withdrawal approvals (Android Phase 3)
app.use('/api/v1/admin/wallet', adminWalletRouter);

// Runtime tenant settings (Android Phase 6): UPI / WhatsApp / min deposit
app.use('/api/v1/tenant', tenantRouter);
app.use('/api/v1/admin/tenant', adminTenantRouter);

// Player profile stats (Android Phase 6)
app.use('/api/v1/players', playerRouter);

// Owner-only player management (search + ban/unban)
app.use('/api/v1/admin/players', adminPlayerRouter);

// Owner-only staff permission keys (admin web onboarding)
app.use('/api/v1/admin/access', adminAccessRouter);

// Phase 12 — match roster: participants, per-player rewards, cheat flags, bans
app.use('/api/v1/admin/matches', adminMatchRouter);

// Online wallet top-up (Razorpay / mock) — order, verify, webhook, demo.
// Not mounted at all when PAYMENTS_ENABLED=false: the whole surface is absent.
if (paymentConfig.enabled) {
  app.use('/api/payments', paymentRouter);
  app.use('/api/v1/payments', paymentRouter);
}

// ─── 7. SPA deep links + 404 handler ───────────────────────────────────
// `/wallet`, `/matches/:id` etc. are client-side routes: send index.html so a
// browser refresh works. Anything API-ish keeps returning JSON 404.
if (serveAdminWeb) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (!req.accepts('html')) {
      next();
      return;
    }
    const pathname = req.path;
    const isApiLike =
      pathname === '/ws' ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/health') ||
      pathname.startsWith('/time');
    if (isApiLike) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(adminWebIndex, (error) => (error ? next(error) : undefined));
  });
}

// ─── 8. 404 handler for undefined routes ────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound('Route not found'));
});

// ─── 9. Global error handler (LAST) ─────────────────────────────────────
app.use(errorHandler);

export { app };
