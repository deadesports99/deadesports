import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { ApiError } from './utils/ApiError.js';

/** Express application — assembled here, listening happens in server.ts. */
const app = express();

// ─── 1. Security headers ────────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS — allow only the configured client origins ────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── 3. Body parsers ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 4. Simple request logger ───────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip ?? 'unknown'}`);
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

// ─── 6. 404 handler for undefined routes ────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound('Route not found'));
});

// ─── 7. Global error handler (LAST) ─────────────────────────────────────
app.use(errorHandler);

export { app };