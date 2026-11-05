/**
 * Admin "Online payments" tab: money summary + paginated order list.
 * The summary is what the owner reads to answer "kitna paisa aaya aaj".
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type AdminApi = typeof import('../src/services/paymentAdmin.service.js');
let api: AdminApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/paymentAdmin.service.js');
});

const tenantId = 'tenant-1';
const today = new Date();
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function order(over: Record<string, unknown>) {
  return {
    id: `order-${Math.random().toString(16).slice(2)}`,
    tenantId,
    userId: 'player-1',
    provider: 'mock',
    providerOrderId: `order_mock_${Math.random().toString(16).slice(2)}`,
    providerPaymentId: null,
    amountPaise: 50_000,
    currency: 'INR',
    status: 'CREATED',
    failureReason: null,
    createdAt: new Date(),
    capturedAt: null,
    expiresAt: new Date(Date.now() + 900_000),
    ...over,
  };
}

function seed() {
  fake = new FakePrisma({
    users: [
      { id: 'player-1', tenantId, name: 'Ravi', inGameName: 'FF|Ravi', inGameUid: '123456789', phoneNumber: '9999900001' },
      { id: 'player-2', tenantId, name: null, inGameName: null, inGameUid: null, phoneNumber: '9999900002' },
    ],
    paymentOrders: [
      order({ id: 'o-today', status: 'CAPTURED', capturedAt: today, createdAt: today, providerPaymentId: 'pay_1' }),
      order({ id: 'o-old', status: 'CAPTURED', capturedAt: lastWeek, createdAt: lastWeek, amountPaise: 100_00, userId: 'player-2' }),
      order({ id: 'o-pending', status: 'PENDING' }),
      order({ id: 'o-failed', status: 'FAILED', failureReason: 'card declined' }),
      order({ id: 'o-expired', status: 'EXPIRED' }),
      order({ id: 'o-other-tenant', status: 'CAPTURED', capturedAt: today, tenantId: 'tenant-2', amountPaise: 999_00 }),
    ],
  });
  return fake;
}

describe('listAdminPayments', () => {
  beforeEach(() => seed());

  it('summarises collected money per tenant, today vs all time', async () => {
    const out = await api.listAdminPayments(tenantId);

    assert.equal(out.summary.collectedTodayPaise, 50_000, '₹500 today only');
    assert.equal(out.summary.collectedTodayRupees, 500);
    assert.equal(out.summary.collectedTotalPaise, 60_000, '₹500 + ₹100');
    assert.equal(out.summary.collectedTotalRupees, 600);
    assert.equal(out.summary.capturedCount, 2);
    assert.equal(out.summary.pendingCount, 1);
    assert.equal(out.summary.failedCount, 1);
    assert.equal(out.summary.demoMode, true, 'mock gateway => demo money');
  });

  it('lists newest first with the player attached', async () => {
    const out = await api.listAdminPayments(tenantId);
    assert.equal(out.pagination.total, 5, 'other tenants are never listed');
    assert.equal(out.payments.length, 5);

    const named = out.payments.find((p) => p.id === 'o-today');
    assert.equal(named?.player.phoneNumber, '9999900001');
    assert.equal(named?.player.name, 'Ravi');
    assert.equal(named?.amountRupees, 500);
    assert.equal(named?.providerPaymentId, 'pay_1');

    const anonymised = out.payments.find((p) => p.id === 'o-old');
    assert.equal(anonymised?.player.name, null);
    assert.equal(anonymised?.player.phoneNumber, '9999900002');
  });

  it('filters by status groups', async () => {
    const captured = await api.listAdminPayments(tenantId, { status: 'CAPTURED' });
    assert.deepEqual(captured.payments.map((p) => p.id).sort(), ['o-old', 'o-today']);

    const pending = await api.listAdminPayments(tenantId, { status: 'PENDING' });
    assert.deepEqual(pending.payments.map((p) => p.id), ['o-pending']);

    const failed = await api.listAdminPayments(tenantId, { status: 'FAILED' });
    assert.deepEqual(failed.payments.map((p) => p.id), ['o-failed']);
    assert.equal(failed.payments[0].failureReason, 'card declined');

    const expired = await api.listAdminPayments(tenantId, { status: 'EXPIRED' });
    assert.deepEqual(expired.payments.map((p) => p.id), ['o-expired']);
  });

  it('clamps paging so a huge limit cannot dump the table', async () => {
    const clamped = await api.listAdminPayments(tenantId, { page: -3, limit: 10_000 });
    assert.equal(clamped.pagination.page, 1);
    assert.equal(clamped.pagination.limit, 100);

    const floor = await api.listAdminPayments(tenantId, { limit: 1 });
    assert.equal(floor.pagination.limit, 5, 'minimum page size is 5');
    assert.equal(floor.pagination.totalPages, 1);
  });

  it('rejects an unknown status filter', async () => {
    await assert.rejects(
      () => api.listAdminPayments(tenantId, { status: 'WHATEVER' as any }),
      (err: any) => err.statusCode === 400 && /Unknown status filter/i.test(err.message),
    );
  });
});
