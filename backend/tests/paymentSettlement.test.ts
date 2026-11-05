import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

/** The fake injected in place of `src/config/prisma.ts`. */
let fake: FakePrisma;

function fakeFor(seed: ConstructorParameters<typeof FakePrisma>[0]) {
  fake = new FakePrisma(seed);
  return fake;
}

// Mock the singleton BEFORE the service module is evaluated. The service code
// itself is untouched production code.
type SettlementApi = typeof import('../src/services/payment.settlement.js');
let api: SettlementApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/payment.settlement.js');
});

const tenantId = 'tenant-1';
const userId = 'user-1';
const baseOrder = {
  id: 'po-1',
  tenantId,
  userId,
  amountPaise: 25_000,
  status: 'PENDING',
  provider: 'mock',
  providerOrderId: 'order_mock_1',
  providerPaymentId: null,
  receipt: 'rcpt_1',
  expiresAt: new Date(Date.now() + 600_000),
  createdAt: new Date(),
};

describe('settleCapturedPayment', () => {
  beforeEach(() => {
    fakeFor({
      users: [{ id: userId, tenantId, depositBalance: 100, winningBalance: 0 }],
      paymentOrders: [{ ...baseOrder }],
    });
  });

  it('credits the wallet exactly once and writes one ledger row', async () => {
    const result = await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_1' });

    assert.equal(result.alreadySettled, false);
    assert.equal(result.creditedPaise, 25_000);
    assert.equal(result.balanceAfter, 350, '₹100 + ₹250 = ₹350');

    const order = fake.rowsOf('paymentOrder')[0];
    assert.equal(order.status, 'CAPTURED');
    assert.equal(order.providerPaymentId, 'pay_1');
    assert.ok(order.capturedAt instanceof Date);

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].referenceId, 'po-1');
    assert.equal(ledger[0].type, 'CREDIT');
    assert.equal(ledger[0].balanceType, 'DEPOSIT');
    assert.equal(ledger[0].category, 'ADD_MONEY');
    assert.equal(Number(ledger[0].amount), 250);
    assert.equal(Number(ledger[0].balanceAfter), 350);
  });

  it('is idempotent — a second call credits nothing and adds no ledger row', async () => {
    await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_1' });
    const second = await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_1' });

    assert.equal(second.alreadySettled, true);
    assert.equal(second.creditedPaise, 0);
    assert.equal(second.balanceAfter, 350);
    assert.equal(fake.rowsOf('walletLedger').length, 1, 'no double credit');
    assert.equal(fake.writesTo('user', 'update'), 1);
  });

  it('never loses money when a local EXPIRED order turns out to be paid', async () => {
    fake.rowsOf('paymentOrder')[0].status = 'EXPIRED';

    const result = await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_1' });

    assert.equal(result.alreadySettled, false);
    assert.equal(result.creditedPaise, 25_000);
    assert.equal(fake.rowsOf('walletLedger').length, 1);
  });

  it('stores the checkout signature for audit when provided', async () => {
    await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_1', signature: 'sig_abc' });
    assert.equal(fake.rowsOf('paymentOrder')[0].signature, 'sig_abc');
  });

  it('keeps paise arithmetic exact for awkward amounts (no float drift)', async () => {
    fake.rowsOf('paymentOrder')[0].amountPaise = 3_333;
    const result = await api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: 'pay_9' });
    assert.equal(result.balanceAfter, 133.33);
    assert.equal(Number(fake.rowsOf('walletLedger')[0].amount), 33.33);
  });

  it('rejects unknown orders and missing arguments', async () => {
    await assert.rejects(() => api.settleCapturedPayment({ orderId: 'nope', providerPaymentId: 'p' }), /not found/i);
    await assert.rejects(() => api.settleCapturedPayment({ orderId: '', providerPaymentId: 'p' }), /required/i);
    await assert.rejects(() => api.settleCapturedPayment({ orderId: 'po-1', providerPaymentId: '' }), /required/i);
  });
});

describe('expireStalePaymentOrders', () => {
  it('expires only unpaid orders past their TTL', async () => {
    fakeFor({
      paymentOrders: [
        { ...baseOrder, id: 'a', status: 'CREATED', expiresAt: new Date(Date.now() - 1000) },
        { ...baseOrder, id: 'b', status: 'PENDING', expiresAt: new Date(Date.now() - 1000) },
        { ...baseOrder, id: 'c', status: 'CREATED', expiresAt: new Date(Date.now() + 60_000) },
        { ...baseOrder, id: 'd', status: 'CAPTURED', expiresAt: new Date(Date.now() - 1000) },
      ],
    });

    assert.equal(await api.expireStalePaymentOrders(), 2);
    const statuses = Object.fromEntries(fake.rowsOf('paymentOrder').map((r) => [r.id, r.status]));
    assert.deepEqual(statuses, { a: 'EXPIRED', b: 'EXPIRED', c: 'CREATED', d: 'CAPTURED' });
  });
});

describe('reconcilePaymentOrder', () => {
  beforeEach(() => {
    fakeFor({
      users: [{ id: userId, tenantId, depositBalance: 0 }],
      paymentOrders: [{ ...baseOrder, providerPaymentId: 'pay_1' }],
    });
  });

  it('is a no-op in mock mode (nothing remote to ask)', async () => {
    const result = await api.reconcilePaymentOrder({ tenantId, orderId: 'po-1' });
    assert.equal(result.alreadySettled, false);
    assert.equal(result.status, 'PENDING');
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('reports an already settled order without touching the wallet', async () => {
    fake.rowsOf('paymentOrder')[0].status = 'CAPTURED';
    const result = await api.reconcilePaymentOrder({ tenantId, orderId: 'po-1' });
    assert.equal(result.alreadySettled, true);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('rejects an order that has no gateway payment id yet', async () => {
    fake.rowsOf('paymentOrder')[0].providerPaymentId = null;
    await assert.rejects(() => api.reconcilePaymentOrder({ tenantId, orderId: 'po-1' }), /No gateway payment/i);
  });

  it('rejects orders from another tenant', async () => {
    await assert.rejects(
      () => api.reconcilePaymentOrder({ tenantId: 'other-tenant', orderId: 'po-1' }),
      /not found/i,
    );
  });
});
