import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { adminWalletRouter } from './routes/adminWallet.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { resultRouter } from './routes/result.routes.js';
import { tournamentRouter } from './routes/tournament.routes.js';
import { tenantRouter, adminTenantRouter } from './routes/tenant.routes.js';
import { playerRouter } from './routes/player.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { ApiError } from './utils/ApiError.js';

/** Express application — assembled here, listening happens in server.ts. */
const app = express();

// Cloud providers terminate TLS before forwarding to Node. Trust only the
// explicitly configured proxy in production so req.ip remains rate-limitable.
app.set('trust proxy', env.TRUST_PROXY);

// ─── 1. Security headers ────────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS — allow configured client origins (or wildcard for mobile APIs)
const allowAllOrigins = env.CORS_ORIGIN.includes('*');
app.use(
  cors({
    origin: allowAllOrigins ? true : env.CORS_ORIGIN,
    credentials: !allowAllOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── 3. Body parsers ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 4. Simple request logger (Sanitized to prevent Log Injection) ───────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const safeMethod = req.method.replace(/[\r\n]/g, '');
  const safeUrl = req.originalUrl.replace(/[\r\n]/g, '');
  const safeIp = (req.ip ?? 'unknown').replace(/[\r\n]/g, '');
  console.log(`[${new Date().toISOString()}] ${safeMethod} ${safeUrl} - IP: ${safeIp}`);
  next();
});

// ─── 5. Routes ──────────────────────────────────────────────────────────
// Root info banner (nice for quick browser check).
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Free Fire Tournament Platform API',
    version: '1.0.0',
    status: 'running',
    health: ['/health', '/api/v1/health'],
  });
});

// Health routes mounted at both the root alias and the versioned namespace.
// (healthRouter already defines the /health prefix internally, see health.routes.ts)
app.use(healthRouter);
app.use('/api/v1', healthRouter);

// Auth & RBAC
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

// ─── 6. 404 handler for undefined routes ────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound('Route not found'));
});

// ─── 7. Global error handler (LAST) ─────────────────────────────────────
app.use(errorHandler);

export { app };
