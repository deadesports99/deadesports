/**
 * Admin-web session hardening.
 *
 * Pins the four things that make a stolen cookie survivable:
 *   1. every cookie session has a server-side row (`sid`) — revoking kills it
 *   2. rolling renewal keeps an active admin signed in (idle window slides)
 *   3. "log out everywhere" bumps `sessionVersion`, so old tokens die
 *   4. money/settings routes demand a fresh OTP proof (step-up)
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';
// Never hit a real mail provider from a unit test.
process.env.EMAIL_PROVIDER = 'console';

const tenantId = 'tenant-session';
const adminId = 'admin-session';

let fake: FakePrisma;
let sessions: typeof import('../src/services/adminSession.service.js');
let authService: typeof import('../src/services/adminAuth.service.js');
let middleware: typeof import('../src/middlewares/auth.middleware.js');
let stepUp: typeof import('../src/middlewares/stepUp.middleware.js');
let env: typeof import('../src/config/env.js').env;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as never, {
        get: (_target, prop: string) => (fake as unknown as Record<string, unknown>)[prop],
      }),
      disconnectPrisma: async () => {},
    },
  });

  sessions = await import('../src/services/adminSession.service.js');
  authService = await import('../src/services/adminAuth.service.js');
  middleware = await import('../src/middlewares/auth.middleware.js');
  stepUp = await import('../src/middlewares/stepUp.middleware.js');
  env = (await import('../src/config/env.js')).env;
});

function seed() {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, brandName: 'Session Test', isActive: true }],
    users: [
      {
        id: adminId,
        tenantId,
        phoneNumber: '9000000001',
        email: 'owner@session.test',
        name: 'Owner',
        role: 'ADMIN',
        isBanned: false,
        sessionVersion: 0,
        canCreateMatch: true,
        canUpdateRoomId: true,
        canDistributePrize: true,
        canManageWallet: true,
      },
    ],
  });
  middleware.invalidateAuthCache();
}

/** Runs the real authenticate middleware against a fake req/res. */
async function runAuth(headers: Record<string, string>, method = 'GET') {
  const req: any = { method, headers: { ...headers } };
  const cookies: { name: string; value: string }[] = [];
  const res: any = {
    cookie: (name: string, value: string) => cookies.push({ name, value }),
    clearCookie: () => undefined,
  };
  let error: any = null;
  let passed = false;

  await middleware.authenticate(req, res, (err?: unknown) => {
    if (err) error = err;
    else passed = true;
  });

  return { req, res, cookies, error, passed };
}

function user() {
  return fake.store.user[0] as any;
}

describe('admin session store', () => {
  beforeEach(seed);

  it('signs in with a server-side session row and a sid/sv bound token', async () => {
    const issued = await sessions.createAdminSession(user(), {
      ip: '1.2.3.4',
      userAgent: 'UnitTest/1.0',
    });

    const rows = fake.rowsOf('adminSession');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, issued.sessionId);
    assert.equal(rows[0].userId, adminId);

    const payload: any = jwt.decode(issued.token);
    assert.equal(payload.sid, issued.sessionId);
    assert.equal(payload.sv, 0);

    // The cookie lives exactly as long as the idle window.
    const idleMs = env.ADMIN_SESSION_TTL_HOURS * 3600_000;
    assert.equal(issued.cookieMaxAgeMs, idleMs);

    // Absolute cap is 30 days by default, regardless of rolling renewals.
    const capMs = env.ADMIN_SESSION_MAX_DAYS * 86_400_000;
    assert.ok(Math.abs(rows[0].expiresAt.getTime() - (Date.now() + capMs)) < 5_000);
  });

  it('accepts a live cookie and rejects it the moment it is revoked', async () => {
    const issued = await sessions.createAdminSession(user());

    const ok = await runAuth({ cookie: `admin_session=${issued.token}` });
    assert.equal(ok.error, null);
    assert.equal(ok.passed, true);
    assert.equal(ok.req.sessionId, issued.sessionId);
    assert.equal(ok.req.authVia, 'cookie');

    await sessions.revokeSession(adminId, issued.sessionId, 'stolen');

    const killed = await runAuth({ cookie: `admin_session=${issued.token}` });
    assert.equal(killed.passed, false);
    assert.match(String(killed.error?.message), /signed out|no longer exists/i);
  });

  it('refuses tokens minted before sessions were tracked (no sid)', async () => {
    const legacy = jwt.sign(
      { userId: adminId, tenantId, role: 'ADMIN' },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const result = await runAuth({ cookie: `admin_session=${legacy}` });
    assert.equal(result.passed, false);
    assert.match(String(result.error?.message), /sign in again/i);
  });

  it('rolls the cookie forward once half the idle window is used', async () => {
    const issued = await sessions.createAdminSession(user());
    const session = await sessions.getActiveSession(issued.sessionId);

    // Fresh token: nothing to do.
    const fresh = await sessions.rollSession(user(), session, {
      tokenExpiresAtMs: Date.now() + env.ADMIN_SESSION_TTL_HOURS * 3600_000,
    });
    assert.equal(fresh, null);

    // A token with 10% of its window left must be renewed.
    const renewed = await sessions.rollSession(user(), session, {
      tokenExpiresAtMs: Date.now() + env.ADMIN_SESSION_TTL_HOURS * 3600_000 * 0.1,
    });
    assert.ok(renewed);
    assert.equal(jwt.decode(renewed!.token)!.sid, issued.sessionId);
    assert.ok(renewed!.cookieMaxAgeMs > env.ADMIN_SESSION_TTL_HOURS * 3600_000 * 0.9);
  });

  it('re-issues the cookie during a real request', async () => {
    // Simulate a nearly-expired token for the same live row.
    const issued = await sessions.createAdminSession(user());
    const shortToken = jwt.sign(
      { userId: adminId, tenantId, role: 'ADMIN', sid: issued.sessionId, sv: 0 },
      env.JWT_SECRET,
      { expiresIn: '10m' },
    );

    const result = await runAuth({ cookie: `admin_session=${shortToken}` });
    assert.equal(result.error, null);
    assert.equal(result.cookies.length, 1);
    assert.equal(result.cookies[0].name, 'admin_session');
  });

  it('"log out everywhere" bumps sessionVersion and revokes every row', async () => {
    const first = await sessions.createAdminSession(user());
    const second = await sessions.createAdminSession(user());

    const revoked = await sessions.revokeAllSessions(adminId, 'revoked-everywhere');
    assert.equal(revoked, 2);
    assert.equal(user().sessionVersion, 1);

    for (const issued of [first, second]) {
      const result = await runAuth({ cookie: `admin_session=${issued.token}` });
      assert.equal(result.passed, false);
    }
  });

  it('"log out other devices" keeps the caller signed in', async () => {
    const keep = await sessions.createAdminSession(user());
    const other = await sessions.createAdminSession(user());

    const revoked = await sessions.revokeOtherSessions(adminId, keep.sessionId);
    assert.equal(revoked, 1);

    assert.equal((await runAuth({ cookie: `admin_session=${keep.token}` })).passed, true);
    assert.equal((await runAuth({ cookie: `admin_session=${other.token}` })).passed, false);
  });

  it('lists sessions with the current one flagged', async () => {
    const current = await sessions.createAdminSession(user(), { userAgent: 'Chrome/1' });
    await sessions.createAdminSession(user(), { userAgent: 'Firefox/1' });

    const rows = await sessions.listSessions(adminId, current.sessionId);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.current).length, 1);
    assert.ok(rows.every((row) => row.active));
  });

  it('treats an expired row as dead even when the JWT is still valid', async () => {
    const issued = await sessions.createAdminSession(user());
    fake.store.adminSession[0].expiresAt = new Date(Date.now() - 1000);

    const result = await runAuth({ cookie: `admin_session=${issued.token}` });
    assert.equal(result.passed, false);
    assert.match(String(result.error?.message), /expired/i);
  });
});

describe('step-up confirmation', () => {
  beforeEach(seed);

  const actor = { userId: adminId, tenantId, role: 'ADMIN' };

  it('mails a dedicated STEP_UP code and returns a short-lived proof', async () => {
    const sent = await authService.requestStepUpOtp(actor);
    assert.equal(sent.email, 'owner@session.test');
    assert.equal(sent.debugOtp?.length, 6);

    const rows = fake.rowsOf('emailOtp');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'ADMIN_STEP_UP', 'a login code can never be replayed as a proof');

    const proof = await authService.verifyStepUpOtp(actor, {
      otp: sent.debugOtp!,
      email: sent.email,
    });

    const payload = stepUp.verifyStepUpToken(proof.token);
    assert.ok(payload);
    assert.equal(payload!.userId, adminId);
    assert.equal(payload!.purpose, 'step-up');
    assert.equal(fake.rowsOf('emailOtp').length, 0, 'proof code is burned');
  });

  it('rejects a wrong code and stops after five attempts', async () => {
    const sent = await authService.requestStepUpOtp(actor);
    assert.ok(sent.debugOtp);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        () => authService.verifyStepUpOtp(actor, { otp: '000000', email: sent.email }),
        /invalid or expired/i,
      );
    }
    await assert.rejects(
      () => authService.verifyStepUpOtp(actor, { otp: sent.debugOtp!, email: sent.email }),
      /too many wrong codes/i,
    );
  });

  it('a login code cannot be used as a step-up proof', async () => {
    const login = await authService.requestAdminOtp({ email: 'owner@session.test' });
    assert.ok(login.debugOtp);

    await assert.rejects(
      () => authService.verifyStepUpOtp(actor, { otp: login.debugOtp!, email: login.debugOtp ? 'owner@session.test' : '' }),
      /invalid or expired/i,
    );
  });
});

describe('requireStepUp guard', () => {
  beforeEach(seed);

  function guardRequest(via: 'cookie' | 'bearer', tokenHeader?: string) {
    const req: any = {
      method: 'POST',
      headers: tokenHeader ? { 'x-step-up-token': tokenHeader } : {},
      user: { userId: adminId, tenantId, role: 'ADMIN' },
      authVia: via,
      sessionId: 'session-1',
    };
    let error: any = null;
    let passed = false;
    stepUp.requireStepUp('paying out prizes')(req, {} as any, (err?: unknown) => {
      if (err) error = err;
      else passed = true;
    });
    return { error, passed };
  }

  it('blocks a cookie session with no proof (machine-readable code)', () => {
    const result = guardRequest('cookie');
    assert.equal(result.passed, false);
    assert.equal(result.error.statusCode, 403);
    assert.equal((result.error.details as any).code, 'STEP_UP_REQUIRED');
    assert.equal((result.error.details as any).action, 'paying out prizes');
  });

  it('blocks an expired or foreign proof', () => {
    const foreign = stepUp.signStepUpToken({ id: 'someone-else', tenantId });
    assert.equal(guardRequest('cookie', foreign).passed, false);

    const expired = jwt.sign(
      { userId: adminId, tenantId, purpose: 'step-up' },
      env.JWT_SECRET,
      { expiresIn: -10, issuer: 'freefire-tournament-api', audience: 'firefree-tournament-steps' },
    );
    assert.equal(guardRequest('cookie', expired).passed, false);
  });

  it('passes with a valid proof for this account', () => {
    const proof = stepUp.signStepUpToken({ id: adminId, tenantId }, 'session-1');
    assert.equal(guardRequest('cookie', proof).passed, true);
  });

  it('refuses a proof minted for another browser', () => {
    const foreignSession = stepUp.signStepUpToken({ id: adminId, tenantId }, 'some-other-session');
    assert.equal(guardRequest('cookie', foreignSession).passed, false);
  });

  it('does not gate Bearer (Android) sessions', () => {
    assert.equal(guardRequest('bearer').passed, true);
  });
});
