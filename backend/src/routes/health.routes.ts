import { Router } from 'express';
import os from 'node:os';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

/**
 * Health-check routes. Mounted at BOTH:
 *   - /health            (root alias)
 *   - /api/v1/health     (namespaced alias)
 * which yields:
 *   GET /health                -> server health
 *   GET /health/db             -> PostgreSQL liveness + latency
 *   GET /health/redis          -> Redis liveness + latency
 */
export const healthRouter: Router = Router();

/**
 * Runs a promise but rejects with "Timed out" if it does not settle in time.
 * Needed because ioredis (with maxRetriesPerRequest: null) queues commands
 * forever while Redis is down — the health check must never hang.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

healthRouter.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  sendResponse(res, 200, 'Service is healthy', {
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
    },
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
  });
});

healthRouter.get('/health/db', async (_req, res, next) => {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 4000, 'database check');
    sendResponse(res, 200, 'Database is healthy', {
      latencyMs: Date.now() - start,
      provider: 'postgresql',
    });
  } catch (err) {
    next(ApiError.internal('Database health check failed'));
  }
});

healthRouter.get('/health/redis', async (_req, res, next) => {
  const start = Date.now();
  try {
    const pong: string = await withTimeout(redis.ping(), 3000, 'redis check');
    if (pong !== 'PONG') {
      throw new Error(`Unexpected Redis reply: ${pong}`);
    }
    sendResponse(res, 200, 'Redis is healthy', {
      latencyMs: Date.now() - start,
    });
  } catch (err) {
    next(ApiError.internal('Redis health check failed'));
  }
});