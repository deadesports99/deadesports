/**
 * Razorpay gateway path (the real REST branch) with `fetch` stubbed:
 * order creation payload, credential handling, gateway errors and the
 * reconciliation lookup. No network is touched.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

type GatewayApi = typeof import('../src/services/paymentGateway.service.js');
let gateway: GatewayApi['paymentGateway'];

const realFetch = globalThis.fetch;
const calls: Array<{ url: string; init: RequestInit }> = [];
let nextResponse: { ok: boolean; status: number; text: string } | ((url: string) => any) = {
  ok: true,
  status: 200,
  text: '{}',
};

before(async () => {
  mock.module('../src/config/payment.js', {
    namedExports: {
      paymentConfig: {
        provider: 'razorpay',
        currency: 'INR',
        orderTtlSeconds: 900,
        minAmountPaise: 1_000,
        maxAmountPaise: 1_000_000,
        mockSecret: 'mock_secret',
        demoMode: false,
        publicBaseUrl: 'http://localhost:5000',
        razorpay: { keyId: 'rzp_test_key', keySecret: 'rzp_test_secret', webhookSecret: 'whsec_test' },
      },
      default: {},
    },
  });
  const mod = await import('../src/services/paymentGateway.service.js');
  gateway = mod.paymentGateway;
});

beforeEach(() => {
  calls.length = 0;
  nextResponse = { ok: true, status: 200, text: '{}' };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const spec = typeof nextResponse === 'function' ? nextResponse(String(url)) : nextResponse;
    return {
      ok: spec.ok,
      status: spec.status,
      text: async () => spec.text,
    } as any;
  }) as any;
});

describe('razorpay order creation', () => {
  it('posts the order with basic auth and keeps the local id in notes', async () => {
    nextResponse = {
      ok: true,
      status: 200,
      text: JSON.stringify({ id: 'order_RZP1', amount: 50_000, currency: 'INR', status: 'created' }),
    };

    const order = await gateway.createOrder({
      amountPaise: 50_000,
      receipt: 'rcpt_1',
      notes: { orderId: 'local-1', userId: 'u1' },
    });

    assert.equal(order.provider, 'razorpay');
    assert.equal(order.orderId, 'order_RZP1');
    assert.equal(order.amountPaise, 50_000);
    assert.equal(order.keyId, 'rzp_test_key');
    assert.equal(order.checkoutUrl, null, 'real gateway uses the SDK, not a URL');

    const [call] = calls;
    assert.match(call.url, /\/orders$/);
    assert.equal(call.init.method, 'POST');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${Buffer.from('rzp_test_key:rzp_test_secret').toString('base64')}`);
    assert.equal(headers.Authorization.includes('rzp_test_secret'), false, 'secret never appears in raw form');

    const body = JSON.parse(String(call.init.body));
    assert.equal(body.amount, 50_000);
    assert.equal(body.receipt, 'rcpt_1');
    assert.deepEqual(body.notes, { orderId: 'local-1', userId: 'u1' });
    assert.ok(body.expire_by > Math.floor(Date.now() / 1000));
  });

  it('turns a gateway error into a clean 502 without leaking keys', async () => {
    nextResponse = {
      ok: false,
      status: 400,
      text: JSON.stringify({ error: { description: 'amount is invalid' } }),
    };

    await assert.rejects(
      () => gateway.createOrder({ amountPaise: 10, receipt: 'r', notes: {} }),
      (err: any) => {
        assert.equal(err.statusCode, 502);
        assert.match(err.message, /amount is invalid/);
        assert.equal(err.message.includes('rzp_test_secret'), false);
        return true;
      },
    );
  });

  it('reports an unreachable gateway (network throw or proxy HTML)', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as any;
    await assert.rejects(
      () => gateway.createOrder({ amountPaise: 10, receipt: 'r', notes: {} }),
      /Payment gateway unreachable/,
    );

    globalThis.fetch = (async () => ({ ok: false, status: 502, text: async () => '<html>bad gateway</html>' })) as any;
    await assert.rejects(
      () => gateway.createOrder({ amountPaise: 10, receipt: 'r', notes: {} }),
      /HTTP 502/,
    );
  });

  it('refuses to call the gateway without keys', async () => {
    const config = (await import('../src/config/payment.js')).paymentConfig as any;
    const keys = config.razorpay;
    config.razorpay = { keyId: null, keySecret: null, webhookSecret: null };
    try {
      await assert.rejects(
        () => gateway.createOrder({ amountPaise: 10, receipt: 'r', notes: {} }),
        /keys are not configured/i,
      );
      assert.equal(calls.length, 0, 'no request without credentials');
    } finally {
      config.razorpay = keys;
    }
  });
});

describe('razorpay reconciliation + signatures', () => {
  it('fetches a payment and normalises the fields', async () => {
    nextResponse = {
      ok: true,
      status: 200,
      text: JSON.stringify({ id: 'pay_1', order_id: 'order_RZP1', status: 'captured', amount: 50_000 }),
    };

    const payment = await gateway.fetchPayment('pay_1');
    assert.deepEqual(payment, { id: 'pay_1', orderId: 'order_RZP1', status: 'captured', amountPaise: 50_000 });
    assert.match(calls[0].url, /\/payments\/pay_1$/);
  });

  it('verifies checkout and webhook signatures with the Razorpay secret', async () => {
    const crypto = await import('node:crypto');
    const checkout = crypto
      .createHmac('sha256', 'rzp_test_secret')
      .update('order_RZP1|pay_1')
      .digest('hex');
    assert.equal(
      gateway.verifyCheckoutSignature({ orderId: 'order_RZP1', paymentId: 'pay_1', signature: checkout }),
      true,
    );
    assert.equal(
      gateway.verifyCheckoutSignature({ orderId: 'order_RZP1', paymentId: 'pay_2', signature: checkout }),
      false,
    );
    assert.equal(gateway.verifyCheckoutSignature({ orderId: '', paymentId: 'p', signature: 's' }), false);

    const raw = Buffer.from('{"event":"payment.captured"}');
    const webhook = crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
    assert.equal(gateway.verifyWebhookSignature(raw, webhook), true);
    assert.equal(gateway.verifyWebhookSignature(raw, 'deadbeef'), false);
    assert.equal(gateway.verifyWebhookSignature(Buffer.alloc(0), webhook), false);
  });

  it('exposes the configured provider name', () => {
    assert.equal(gateway.provider, 'razorpay');
  });
});

// Restore the real fetch so later files are unaffected within this process.
process.on('beforeExit', () => {
  globalThis.fetch = realFetch;
});
