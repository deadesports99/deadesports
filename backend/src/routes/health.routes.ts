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
    await prisma.$queryRaw`SELECT 1`;
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
    const pong: string = await redis.ping();
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