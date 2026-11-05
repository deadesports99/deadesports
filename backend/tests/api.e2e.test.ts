/**
 * HTTP end-to-end tests: real Express app + real middleware (auth, zod, error
 * handler) behind a real socket. Only the database, Redis, FCM and websocket
 * layer are replaced, so routing/contract regressions are caught here.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

// Rate limiters step aside in tests (they have their own unit tests).
process.env.NODE_ENV = 'test';

let fake: FakePrisma;
let server: import('node:http').Server;
let baseUrl = '';
let env: typeof import('../src/config/env.js').env;

const tenantId = 'tenant-1';
const userId = 'user-1';
const adminId = 'admin-1';

before(async () => {
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
  mock.module('../src/services/slotLock.service.js', {
    namedExports: {
      reserveSlot: async () => ({ ok: true }),
      releaseSlot: async () => {},
      getOccupiedSlots: async () => ({}),
      hydrateSlotsFromDb: async () => {},
      createTeam: async () => true,
      joinTeam: async () => ({ ok: true, teamId: 'team-1' }),
      deleteTeam: async () => {},
      decrementTeamMembers: async () => {},
      generateTeamCode: () => '123456',
      getTeamMembers: async () => 1,
      clearTournamentRedis: async () => {},
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

after(() => {
  server?.close();
});

function token(forUserId = userId, role = 'USER') {
  return jwt.sign({ userId: forUserId, tenantId, role }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function call(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; as?: string; role?: string } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) headers.Authorization = `Bearer ${token(options.as, options.role)}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

const player = () => ({
  id: userId,
  tenantId,
  phoneNumber: '9999900001',
  role: 'USER',
  isBanned: false,
  depositBalance: 100,
  winningBalance: 50,
  playerCode: 'THU-0001',
  inGameUid: '123456789',
  canCreateMatch: false,
  canUpdateRoomId: false,
  canDistributePrize: false,
  canManageWallet: false,
  createdAt: new Date(),
});

function seed() {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, subdomain: 'thunder', brandName: 'Thunder', isActive: true, allowPhoneAuth: true, minDeposit: 10 }],
    users: [player(), { ...player(), id: adminId, role: 'ADMIN', canManageWallet: true, phoneNumber: '9999900002' }],
    tournaments: [{
      id: 'tour-1', tenantId, title: 'Bermuda Solo #1', status: 'OPEN', matchType: 'SOLO',
      entryFee: 25, totalSlots: 48, prizePool: 400, perKillPrize: 10,
      visibleFrom: null, matchTime: new Date(Date.now() + 3_600_000),
    }],
  });
  return fake;
}

describe('HTTP API surface', () => {
  beforeEach(() => seed());

  it('serves the health probe', async () => {
    const res = await call('/api/v1/health', { auth: false });
    assert.equal(res.status, 200);
  });

  it('rejects protected routes without a token using the standard error envelope', async () => {
    const res = await call('/api/v1/wallet', { auth: false });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authorization/i);
  });

  it('rejects a tampered / expired token', async () => {
    const headers = { Authorization: 'Bearer not.a.real.token' };
    const res = await fetch(`${baseUrl}/api/v1/wallet`, { headers });
    assert.equal(res.status, 401);
  });

  it('returns wallet balances in the success envelope', async () => {
    const res = await call('/api/v1/wallet');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.depositBalance, '100.00');
    assert.equal(res.body.data.winningBalance, '50.00');
    assert.equal(res.body.data.totalBalance, '150.00');
  });

  it('accepts an Add Cash request and blocks the duplicate UTR', async () => {
    const first = await call('/api/v1/wallet/deposit', {
      method: 'POST',
      body: { amount: 250, utrNumber: 'UTR123456789' },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.deposit.status, 'PENDING');
    assert.equal(first.body.data.deposit.amount, '250.00');

    const second = await call('/api/v1/wallet/deposit', {
      method: 'POST',
      body: { amount: 250, utrNumber: 'UTR123456789' },
    });
    assert.equal(second.status, 409);
    assert.match(second.body.message, /already submitted/i);
  });

  it('validates the deposit payload with field-level details', async () => {
    const res = await call('/api/v1/wallet/deposit', {
      method: 'POST',
      body: { amount: -5, utrNumber: 'SHORT' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Validation failed');
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((d: any) => d.field === 'utrNumber'));
  });

  it('joins a tournament: fee debited, seat stored, balance returned', async () => {
    const res = await call('/api/v1/tournaments/tour-1/join', {
      method: 'POST',
      body: { slotNumber: 4 },
    });
    assert.ok([200, 201].includes(res.status), `unexpected status ${res.status}`);
    assert.equal(res.body.data.slotNumber, 4);
    assert.equal(res.body.data.entryFee, 25);
    assert.equal(res.body.data.balanceAfter, 125, '₹150 - ₹25 fee');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 75);
    assert.equal(fake.rowsOf('tournamentSlot').length, 1);
  });

  it('surfaces business errors as clean 4xx responses (insufficient balance)', async () => {
    fake.rowsOf('user')[0].depositBalance = 5;
    fake.rowsOf('user')[0].winningBalance = 5;

    const res = await call('/api/v1/tournaments/tour-1/join', {
      method: 'POST',
      body: { slotNumber: 1 },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Insufficient balance/i);
  });

  it('holds withdrawal money from the winning balance', async () => {
    const res = await call('/api/v1/wallet/withdraw', {
      method: 'POST',
      body: { amount: 50, upiId: 'player@okaxis' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.winningBalance, 0, 'minimum payout is ₹50');
    assert.equal(fake.rowsOf('user')[0].winningBalance, 0);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100, 'top-up money is untouched');
  });

  it('forbids non-managers from the admin wallet console', async () => {
    const res = await call('/api/v1/admin/wallet/withdrawals');
    assert.equal(res.status, 403);

    const allowed = await call('/api/v1/admin/wallet/withdrawals', { as: adminId, role: 'ADMIN' });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.success, true);
  });

  it('answers unknown routes with a JSON 404 envelope', async () => {
    const res = await call('/api/v1/definitely-not-a-route', { auth: false });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Route not found');
  });

  it('always exposes the server time header (anti clock-spoofing)', async () => {
    const res = await call('/api/v1/health', { auth: false });
    assert.match(res.headers.get('x-server-time') ?? '', /^\d{13}$/);
  });

});

describe('online top-up over HTTP (mock gateway)', () => {
  beforeEach(() => seed());

  it('publishes the gateway configuration without authentication', async () => {
    const res = await call('/api/v1/payments/config', { auth: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.provider, 'mock');
    assert.equal(res.body.data.currency, 'INR');
    assert.equal(res.body.data.demoMode, true);
    assert.ok(res.body.data.minAmountPaise > 0);
  });

  it('rejects amounts outside the configured paise limits', async () => {
    const tooSmall = await call('/api/v1/payments/orders', { method: 'POST', body: { amountPaise: 100 } });
    assert.equal(tooSmall.status, 400);
    assert.match(tooSmall.body.message, /Minimum amount/i);

    const tooBig = await call('/api/v1/payments/orders', { method: 'POST', body: { amountPaise: 10_000_000 } });
    assert.equal(tooBig.status, 400);
    assert.match(tooBig.body.message, /Maximum amount/i);
  });

  it('creates an order and credits the wallet exactly once on verify', async () => {
    const { paymentGateway } = await import('../src/services/paymentGateway.service.js');

    const created = await call('/api/v1/payments/orders', { method: 'POST', body: { amountPaise: 50_000 } });
    assert.equal(created.status, 201);
    const { orderId, providerOrderId } = created.body.data;
    assert.equal(created.body.data.amountPaise, 50_000);
    assert.ok(created.body.data.checkoutUrl.includes('demo/checkout'));

    const pending = await call(`/api/v1/payments/orders/${orderId}`);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.data.status, 'CREATED');

    const paymentId = 'pay_mock_1';
    // Razorpay signs `<provider_order_id>|<payment_id>`.
    const signature = paymentGateway.mockSignature(providerOrderId, paymentId);
    const verified = await call('/api/v1/payments/verify', {
      method: 'POST',
      body: { orderId, paymentId, signature },
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(fake.rowsOf('user')[0].depositBalance, 600, '₹100 + ₹500');
    assert.equal(fake.rowsOf('walletLedger').length, 1);
    assert.equal(fake.rowsOf('walletLedger')[0].referenceId, orderId);

    // A double tap / retry must not credit twice.
    const again = await call('/api/v1/payments/verify', {
      method: 'POST',
      body: { orderId, paymentId, signature },
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.data.alreadySettled, true);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 600);
    assert.equal(fake.rowsOf('walletLedger').length, 1);
  });

  it('rejects a forged checkout signature', async () => {
    const created = await call('/api/v1/payments/orders', { method: 'POST', body: { amountPaise: 20_000 } });
    const { orderId } = created.body.data;

    const forged = await call('/api/v1/payments/verify', {
      method: 'POST',
      body: { orderId, paymentId: 'pay_mock_x', signature: 'deadbeef' },
    });
    assert.equal(forged.status, 400);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100, 'nothing credited');
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('hides payment orders that belong to another player', async () => {
    const created = await call('/api/v1/payments/orders', { method: 'POST', body: { amountPaise: 20_000 } });
    const { orderId } = created.body.data;

    const asAdmin = await call(`/api/v1/payments/orders/${orderId}`, { as: adminId, role: 'ADMIN' });
    assert.equal(asAdmin.status, 403);
  });
});
