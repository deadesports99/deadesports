/**
 * CSRF gate for cookie-authenticated admin sessions.
 *
 * `assertCookieRequestOrigin()` is the only thing standing between an httpOnly
 * session cookie and a cross-site form post, and until now nothing tested it.
 * These cases pin the exact rules read off `src/middlewares/auth.middleware.ts`:
 *
 *   - only cookie sessions are gated (Android Bearer tokens are not)
 *   - only state-changing methods (GET/HEAD/OPTIONS are always fine)
 *   - the request must carry Origin or Referer matching ADMIN_WEB_ORIGIN/CORS_ORIGIN
 *   - a missing Origin *and* Referer is a block, not a pass
 *   - `CORS_ORIGIN=*` (dev wildcard) switches the whole gate off
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

let fake: FakePrisma;
let server: import('node:http').Server;
let baseUrl = '';
let env: typeof import('../src/config/env.js').env;

const tenantId = 'tenant-csrf';
const adminId = 'admin-csrf';

const adminUser = () => ({
  id: adminId,
  tenantId,
  role: 'ADMIN',
  phoneNumber: '9999900011',
  playerCode: 'THU-0011',
  email: 'owner@csrftest.local',
  isBanned: false,
  canCreateMatch: true,
  canUpdateRoomId: true,
  canDistributePrize: true,
  canManageWallet: true,
  createdAt: new Date(),
});

const tenant = () => ({
  id: tenantId,
  slug: 'csrf-test',
  brandName: 'CSRF Test',
  isActive: true,
  currency: 'INR',
  createdAt: new Date(),
});

before(async () => {
  fake = new FakePrisma({ users: [adminUser()], tenants: [tenant()] });

  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  mock.module('../src/config/redis.js', {
    namedExports: {
      redis: {
        eval: async () => 0,
        hgetall: async () => ({}),
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        keys: async () => [],
        status: 'ready',
      },
      disconnectRedis: async () => {},
    },
  });
  mock.module('../src/services/fcm.service.js', {
    namedExports: {
      pushToUser: async () => {},
      pushToUsers: async () => {},
      pushToTournamentParticipants: async () => {},
    },
  });
  mock.module('../src/services/realtime.service.js', {
    namedExports: {
      realtimeService: {
        broadcast: () => {},
        broadcastToTenant: () => {},
        sendToUser: () => {},
        sendToUsers: () => {},
      },
    },
  });

  env = (await import('../src/config/env.js')).env;
  const { app } = await import('../src/app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server?.close());

/** Fresh cookie session token (same payload the login controller signs). */
const sessionToken = () =>
  jwt.sign({ userId: adminId, tenantId, role: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '1h' });

interface CallOptions {
  method?: string;
  origin?: string;
  referer?: string;
  bearer?: boolean;
}

async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.bearer) headers.authorization = `Bearer ${sessionToken()}`;
  else headers.cookie = `admin_session=${sessionToken()}`;
  if (options.origin !== undefined) headers.origin = options.origin;
  if (options.referer !== undefined) headers.referer = options.referer;
  return fetch(`${baseUrl}${path}`, { method: options.method ?? 'GET', headers });
}

describe('CSRF origin gate', () => {
  // The production gate must be live here, not the dev wildcard.
  it('runs with a real allow-list (no CORS wildcard)', () => {
    assert.equal(env.CORS_ORIGIN.includes('*'), false);
    assert.ok(env.ADMIN_WEB_ORIGIN.startsWith('http'));
  });

  it('allows a cookie mutation from the configured admin origin', async () => {
    const res = await call('/api/v1/auth/admin/logout', {
      method: 'POST',
      origin: env.ADMIN_WEB_ORIGIN,
    });
    assert.equal(res.status, 200, await res.text());
  });

  it('blocks a cookie mutation from another origin', async () => {
    const res = await call('/api/v1/auth/admin/logout', {
      method: 'POST',
      origin: 'https://evil.example',
    });
    assert.equal(res.status, 403);
    assert.match((await res.json()).message, /Blocked cross-site request/);
  });

  it('blocks a cookie mutation with no Origin and no Referer', async () => {
    // A browser always sends one of them for a real form/fetch; a naked request
    // with a valid cookie is exactly the shape of a CSRF attempt.
    const res = await call('/api/v1/auth/admin/logout', { method: 'POST' });
    assert.equal(res.status, 403);
    assert.match((await res.json()).message, /Blocked cross-site request/);
  });

  it('accepts a matching Referer (sub-path) when Origin is absent', async () => {
    const res = await call('/api/v1/auth/admin/logout', {
      method: 'POST',
      referer: `${env.ADMIN_WEB_ORIGIN}/wallet`,
    });
    assert.equal(res.status, 200, await res.text());
  });

  it('accepts any configured CORS origin', async () => {
    const allowed = env.CORS_ORIGIN.find((value) => value !== '*');
    assert.ok(allowed, 'test needs at least one real CORS origin');
    const res = await call('/api/v1/auth/admin/logout', { method: 'POST', origin: allowed });
    assert.equal(res.status, 200, await res.text());
  });

  it('never gates a Bearer-token request (Android has no cookie)', async () => {
    const res = await call('/api/v1/auth/admin/logout', {
      method: 'POST',
      bearer: true,
      origin: 'https://evil.example',
    });
    assert.equal(res.status, 200, await res.text());
  });

  it('never gates GET requests, even cross-origin', async () => {
    const res = await call('/api/v1/admin/access', { origin: 'https://evil.example' });
    assert.equal(res.status, 200, await res.text());
  });

  it('still rejects an unauthenticated request before any origin check', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/admin/logout`, {
      method: 'POST',
      headers: { origin: env.ADMIN_WEB_ORIGIN },
    });
    assert.equal(res.status, 401);
  });
});
