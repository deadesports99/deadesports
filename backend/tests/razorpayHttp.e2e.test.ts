/**
 * Razorpay over **real HTTP**: a local stub speaks the Razorpay REST shape, and
 * the app is exercised end-to-end through it (order create -> checkout verify ->
 * settle, and the webhook path).
 *
 * Why this file exists: `paymentGatewayRazorpay.test.ts` stubs `fetch`, so it
 * proves the payload/auth logic but not the wiring (real sockets, real headers,
 * real JSON round-trip, raw-body HMAC through express). Live keys are not
 * available in CI, so a faithful local stub is the next best thing — it is what
 * makes the "did we configure the gateway right" class of bug catchable before
 * a real ₹1 payment (see docs/RAZORPAY_LIVE_RUNBOOK.md for the live run).
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';
import { registerFakeFirebase } from './helpers/fakeFirebase.js';

const KEY_ID = 'rzp_test_local_123';
const KEY_SECRET = 'local_key_secret';
const WEBHOOK_SECRET = 'local_webhook_secret';

const tenantId = 'tenant-1';

/** Captured by the stub so tests can assert what the backend actually sent. */
const seen: {
  auth?: string;
  orderBody?: any;
  paymentStatus: string;
  paymentAmount: number;
  failOrders: boolean;
} = { paymentStatus: 'captured', paymentAmount: 0, failOrders: false };

let gatewayServer: http.Server;
let appServer: http.Server;
let baseUrl = '';
let fake: FakePrisma;
let token = '';
let providerOrderId = '';
let orderId = '';

const hmac = (data: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(data).digest('hex');

async function post(path: string, body: unknown, bearer?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function get(path: string, bearer?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
  return { status: res.status, json: (await res.json()) as any };
}

before(async () => {
  // ── Local Razorpay stub ──────────────────────────────────────────────
  gatewayServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      seen.auth = req.headers.authorization;

      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'POST' && req.url === '/v1/orders') {
        if (seen.failOrders) {
          send(400, { error: { description: 'Amount less than minimum amount allowed', code: 'BAD_REQUEST_ERROR' } });
          return;
        }
        seen.orderBody = JSON.parse(raw);
        send(200, {
          id: 'order_rzp_local_1',
          entity: 'order',
          amount: seen.orderBody.amount,
          currency: 'INR',
          status: 'created',
          receipt: seen.orderBody.receipt,
        });
        return;
      }

      const paymentMatch = /^\/v1\/payments\/([^/?]+)$/.exec(req.url ?? '');
      if (req.method === 'GET' && paymentMatch) {
        send(200, {
          id: paymentMatch[1],
          order_id: 'order_rzp_local_1',
          status: seen.paymentStatus,
          amount: seen.paymentAmount,
          currency: 'INR',
          method: 'upi',
        });
        return;
      }

      send(404, { error: { description: 'unknown stub route' } });
    });
  });
  await new Promise<void>((resolve) => gatewayServer.listen(0, '127.0.0.1', resolve));
  const gatewayPort = (gatewayServer.address() as AddressInfo).port;

  // Env BEFORE any config module is imported (they freeze on import).
  process.env.NODE_ENV = 'test';
  process.env.PAYMENT_PROVIDER = 'razorpay';
  process.env.RAZORPAY_KEY_ID = KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_API_BASE_URL = `http://127.0.0.1:${gatewayPort}/v1`;
  process.env.PAYMENT_MIN_AMOUNT_PAISE = '100';

  await registerFakeFirebase();
  fake = new FakePrisma({
    tenants: [{ id: tenantId, subdomain: 'thunder', brandName: 'Thunder eSports', isActive: true, allowPhoneAuth: true }],
    users: [],
  });

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
    namedExports: { pushToUser: async () => {}, pushToUsers: async () => {}, pushToTournamentParticipants: async () => {} },
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

  const { app } = await import('../src/app.js');
  appServer = app.listen(0);
  await new Promise<void>((resolve) => appServer.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(appServer.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  await new Promise<void>((resolve) => appServer?.close(() => resolve()));
  await new Promise<void>((resolve) => gatewayServer?.close(() => resolve()));
});

beforeEach(() => {
  seen.paymentStatus = 'captured';
  seen.paymentAmount = 0;
  seen.failOrders = false;
});

/** A logged-in player with a clean wallet. */
async function newPlayer() {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, subdomain: 'thunder', brandName: 'Thunder eSports', isActive: true, allowPhoneAuth: true }],
    users: [],
  });
  // A real registration (not a hand-signed JWT) so the auth → payment path is real.
  const register = await post('/auth/player/register', {
    tenantId,
    idToken: 'mock_otp_9812345678',
    inGameName: 'Ravi',
    deviceId: 'device-rzp-1',
  });
  assert.equal(register.status, 201, JSON.stringify(register.json));
  token = register.json.data.token;
  return register.json.data.user.id as string;
}

/** Create a top-up order through the real HTTP API. */
async function createTopUp(amountPaise = 100) {
  const res = await post('/payments/orders', { amountPaise }, token);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  orderId = res.json.data.orderId;
  providerOrderId = res.json.data.providerOrderId;
  return res.json.data;
}

describe('razorpay over real HTTP (local stub)', () => {
  it('creates the gateway order with Basic auth and the right money fields', async () => {
    await newPlayer();
    const order = await createTopUp(100);

    assert.equal(order.provider, 'razorpay');
    assert.equal(order.providerOrderId, 'order_rzp_local_1');
    assert.equal(order.keyId, KEY_ID, 'client needs the publishable key to open checkout');
    assert.equal(order.checkoutUrl, null, 'no demo page for a real gateway');

    // Credentials travel as Basic auth (never in a URL or body).
    const expectedAuth = `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`;
    assert.equal(seen.auth, expectedAuth);
    assert.equal(seen.orderBody.amount, 100);
    assert.equal(seen.orderBody.currency, 'INR');
    assert.ok(seen.orderBody.expire_by > Math.floor(Date.now() / 1000), 'gateway-side expiry set');
    assert.deepEqual(Object.keys(seen.orderBody.notes).sort(), ['orderId', 'tenantId', 'userId']);
    assert.ok(!JSON.stringify(seen.orderBody).includes(KEY_SECRET), 'secret never leaves as data');
  });

  it('settles once when checkout returns a valid signature, and is idempotent on retry', async () => {
    const userId = await newPlayer();
    await createTopUp(100);

    const paymentId = 'pay_local_1';
    const signature = hmac(`${providerOrderId}|${paymentId}`, KEY_SECRET);

    const first = await post('/payments/verify', { orderId, paymentId, signature }, token);
    assert.equal(first.status, 200, JSON.stringify(first.json));
    assert.equal(first.json.data.status, 'CAPTURED');
    assert.equal(first.json.data.alreadySettled, false);
    assert.equal(first.json.data.balanceAfter, 1, '₹1 into the wallet');

    const second = await post('/payments/verify', { orderId, paymentId, signature }, token);
    assert.equal(second.status, 200);
    assert.equal(second.json.data.alreadySettled, true);

    const wallet = await get('/wallet', token);
    assert.equal(wallet.json.data.depositBalance, '1.00');
    assert.equal(fake.rowsOf('walletLedger').filter((l) => l.userId === userId).length, 1, 'one ledger row');
  });

  it('rejects a forged signature and marks the order failed, without crediting', async () => {
    await newPlayer();
    await createTopUp(100);

    const res = await post(
      '/payments/verify',
      { orderId, paymentId: 'pay_local_2', signature: hmac(`${providerOrderId}|pay_local_2`, 'wrong-secret') },
      token,
    );

    assert.equal(res.status, 400);
    assert.match(res.json.message, /signature/i);
    const order = await get(`/payments/orders/${orderId}`, token);
    assert.equal(order.json.data.status, 'FAILED');
    assert.equal(order.json.data.failureReason, 'Signature mismatch');
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('settles from a webhook signed over the raw body, and ignores a repeated one', async () => {
    await newPlayer();
    await createTopUp(100);

    const event = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_local_3', order_id: providerOrderId, status: 'captured', amount: 100 } },
      },
    };
    const raw = Buffer.from(JSON.stringify(event), 'utf8');
    const signature = hmac(raw.toString('utf8'), WEBHOOK_SECRET);

    const sendWebhook = async () => {
      const res = await fetch(`${baseUrl}/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
        body: raw,
      });
      return { status: res.status, json: (await res.json()) as any };
    };

    const first = await sendWebhook();
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const captured = await get(`/payments/orders/${orderId}`, token);
    assert.equal(captured.json.data.status, 'CAPTURED');

    const again = await sendWebhook();
    assert.equal(again.status, 200);
    assert.equal(fake.rowsOf('walletLedger').length, 1, 'duplicate delivery never credits twice');
  });

  it('rejects a webhook whose signature does not match the raw bytes', async () => {
    await newPlayer();
    await createTopUp(100);

    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }), 'utf8');
    const res = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'deadbeef' },
      body: raw,
    });

    assert.equal(res.status, 400);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('turns a gateway rejection into 502 and leaves no payable order behind', async () => {
    await newPlayer();
    seen.failOrders = true;

    const res = await post('/payments/orders', { amountPaise: 100 }, token);

    assert.equal(res.status, 502);
    assert.match(res.json.message, /Payment gateway rejected/i);
    const orders = fake.rowsOf('paymentOrder');
    assert.equal(orders.length, 1);
    assert.equal(orders[0].status, 'FAILED', 'the draft order is closed, not left dangling');
    assert.match(String(orders[0].failureReason), /rejected/i);
  });

  it('reports the live gateway config so the app knows it is not demo mode', async () => {
    await newPlayer();
    const cfg = await get('/payments/config');

    assert.equal(cfg.status, 200);
    assert.equal(cfg.json.data.demoMode, false);
    assert.equal(cfg.json.data.provider, 'razorpay');
    assert.equal(cfg.json.data.currency, 'INR');
    // The publishable key travels with each order (checkout needs it); the
    // config endpoint must never leak the secret.
    assert.equal(cfg.json.data.keyId, undefined);
    assert.ok(!JSON.stringify(cfg.json).includes(KEY_SECRET));
  });
});
