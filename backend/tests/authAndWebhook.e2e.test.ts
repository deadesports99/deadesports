/**
 * Auth doors + the Razorpay webhook over real HTTP.
 * The webhook is the money-critical one: it must verify the signature against
 * the RAW body bytes and settle exactly once.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

let fake: FakePrisma;
let server: import('node:http').Server;
let baseUrl = '';
let env: typeof import('../src/config/env.js').env;

const tenantId = 'tenant-1';

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

function seed() {
  fake = new FakePrisma({
    tenants: [
      {
        id: tenantId,
        brandName: 'Thunder',
        isActive: true,
        minDeposit: 10,
        allowPhoneAuth: true,
        allowEmailAuth: true,
        allowGoogleAuth: true,
      },
    ],
    users: [
      {
        id: 'player-1',
        tenantId,
        phoneNumber: '9999900001',
        email: 'player@example.com',
        playerCode: 'THU-0001',
        role: 'USER',
        isBanned: false,
        depositBalance: 100,
        winningBalance: 0,
        fcmToken: null,
        createdAt: new Date(),
      },
    ],
    paymentOrders: [
      {
        id: 'order-1',
        tenantId,
        userId: 'player-1',
        provider: 'mock',
        providerOrderId: 'order_mock_hook',
        amountPaise: 50_000,
        currency: 'INR',
        status: 'CREATED',
        receipt: 'rcpt_hook',
        createdAt: new Date(),
        capturedAt: null,
        expiresAt: new Date(Date.now() + 900_000),
      },
    ],
    emailOtps: [],
  });
  return fake;
}

const playerToken = () =>
  jwt.sign({ userId: 'player-1', tenantId, role: 'USER' }, env.JWT_SECRET, { expiresIn: '1h' });

async function post(path: string, body: unknown, headers: Record<string, string> = {}, raw = false) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: raw ? (body as string) : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

describe('registration + login over HTTP', () => {
  beforeEach(() => seed());

  it('registers a new player with a verified phone token', async () => {
    const res = await post('/api/v1/auth/player/register', {
      tenantId,
      idToken: 'mock_otp_9000011111',
      name: 'New Player',
      deviceId: 'device-abc-123',
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.user.phoneNumber, '9000011111');
    assert.match(res.body.data.user.playerCode, /^THU-\d{4}$/);
    assert.ok(res.body.data.token);
  });

  it('blocks a duplicate registration and a disabled tenant', async () => {
    const duplicate = await post('/api/v1/auth/player/register', {
      tenantId,
      idToken: 'mock_otp_9999900001',
      deviceId: 'device-abc-123',
    });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.message, /already registered/i);

    fake.rowsOf('tenant')[0].isActive = false;
    const inactive = await post('/api/v1/auth/player/register', {
      tenantId,
      idToken: 'mock_otp_9000011111',
    });
    assert.equal(inactive.status, 403);
  });

  it('logs an existing player in and returns their profile', async () => {
    const login = await post('/api/v1/auth/player/login', { tenantId, idToken: 'mock_otp_9999900001' });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.data.user.id, 'player-1');

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${login.body.data.token}` },
    });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.data.phoneNumber, '9999900001');
    assert.equal(meBody.data.passwordHash, undefined);
  });

  it('registers by email + OTP code over HTTP', async () => {
    const sent = await post('/api/v1/auth/player/email/send-otp', {
      tenantId,
      email: 'brand-new@example.com',
      password: 'strongpass',
      type: 'REGISTER',
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const code = sent.body.data.debugOtp;
    assert.match(code, /^\d{6}$/);

    const verified = await post('/api/v1/auth/player/email/verify-otp', {
      tenantId,
      email: 'brand-new@example.com',
      code,
      password: 'strongpass',
      type: 'REGISTER',
      deviceId: 'device-xyz-999',
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.data.user.email, 'brand-new@example.com');
  });

  it('stores the push token and rejects junk', async () => {
    const ok = await post(
      '/api/v1/auth/fcm-token',
      { token: 'fcm-token-abcdefghijklmnop' },
      { Authorization: `Bearer ${playerToken()}` },
    );
    assert.equal(ok.status, 200);

    const bad = await post('/api/v1/auth/fcm-token', { token: 'short' }, { Authorization: `Bearer ${playerToken()}` });
    assert.equal(bad.status, 400);
  });
});

describe('payment webhook', () => {
  beforeEach(() => seed());

  it('rejects a webhook with a bad signature and credits nobody', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_mock_hook', status: 'captured', amount: 50_000 } } },
    });

    const res = await post('/api/v1/payments/webhook', payload, { 'x-razorpay-signature': 'deadbeef' }, true);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid webhook signature');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100, 'no credit');
  });

  it('settles a genuine capture exactly once', async () => {
    const crypto = await import('node:crypto');
    const { paymentConfig } = await import('../src/config/payment.js');
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_mock_hook', status: 'captured', amount: 50_000 } } },
    });
    const signature = crypto.createHmac('sha256', paymentConfig.mockSecret).update(payload).digest('hex');

    const first = await post('/api/v1/payments/webhook', payload, { 'x-razorpay-signature': signature }, true);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(fake.rowsOf('user')[0].depositBalance, 600, '₹100 + ₹500 credited');
    assert.equal(fake.rowsOf('walletLedger').length, 1);

    // Gateway retries the same event — money must not move twice.
    const retry = await post('/api/v1/payments/webhook', payload, { 'x-razorpay-signature': signature }, true);
    assert.equal(retry.status, 200);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 600);
    assert.equal(fake.rowsOf('walletLedger').length, 1);
  });

  it('marks a failed payment without crediting the wallet', async () => {
    const crypto = await import('node:crypto');
    const { paymentConfig } = await import('../src/config/payment.js');
    const payload = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_fail', order_id: 'order_mock_hook', status: 'failed', amount: 50_000 } } },
    });
    const signature = crypto.createHmac('sha256', paymentConfig.mockSecret).update(payload).digest('hex');

    const res = await post('/api/v1/payments/webhook', payload, { 'x-razorpay-signature': signature }, true);
    assert.equal(res.status, 200);
    assert.equal(fake.rowsOf('paymentOrder')[0].status, 'FAILED');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100);
  });

  it('ignores events for unknown orders and empty payloads', async () => {
    const crypto = await import('node:crypto');
    const { paymentConfig } = await import('../src/config/payment.js');
    const sign = (body: string) => crypto.createHmac('sha256', paymentConfig.mockSecret).update(body).digest('hex');

    const unknown = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_2', order_id: 'order_mock_missing', status: 'captured', amount: 100 } } },
    });
    const unknownRes = await post('/api/v1/payments/webhook', unknown, { 'x-razorpay-signature': sign(unknown) }, true);
    assert.equal(unknownRes.status, 200);
    assert.equal(unknownRes.body.message, 'Unknown order');

    const empty = JSON.stringify({ event: 'payment.captured' });
    const emptyRes = await post('/api/v1/payments/webhook', empty, { 'x-razorpay-signature': sign(empty) }, true);
    assert.equal(emptyRes.status, 200);
    assert.equal(emptyRes.body.message, 'Event ignored');
  });
});

describe('demo checkout page', () => {
  beforeEach(() => seed());

  it('serves the mock checkout UI and script', async () => {
    const page = await fetch(`${baseUrl}/api/v1/payments/demo/checkout?orderId=order-1`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await page.text(), /<html/i);

    const script = await fetch(`${baseUrl}/api/v1/payments/demo/checkout.js?orderId=order-1`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type') ?? '', /javascript/);
  });

  it('exposes gateway info without auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/config`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.provider, 'mock');
    assert.equal(body.data.demoMode, true);
  });
});
