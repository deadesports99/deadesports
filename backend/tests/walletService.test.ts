import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type WalletApi = typeof import('../src/services/wallet.service.js');
let api: WalletApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/wallet.service.js');
});

const userId = 'user-1';
const tenantId = 'tenant-1';

function seed() {
  fake = new FakePrisma({
    users: [{ id: userId, tenantId, depositBalance: 350.5, winningBalance: 120 }],
    walletLedger: [
      { id: 'l1', userId, amount: 100, balanceType: 'DEPOSIT', type: 'CREDIT', category: 'ADD_MONEY', balanceAfter: 100, referenceId: 'r1', notes: 'first', createdAt: new Date('2026-11-01T10:00:00Z') },
      { id: 'l2', userId, amount: 50, balanceType: 'WINNING', type: 'CREDIT', category: 'PRIZE', balanceAfter: 150, referenceId: 'r2', notes: 'prize', createdAt: new Date('2026-11-03T10:00:00Z') },
      { id: 'l3', userId, amount: 30, balanceType: 'WINNING', type: 'DEBIT', category: 'WITHDRAWAL', balanceAfter: 120, referenceId: 'r3', notes: 'payout', createdAt: new Date('2026-11-02T10:00:00Z') },
    ],
  });
  return fake;
}

describe('getWalletSummary', () => {
  it('formats both balances and the total to 2 decimals', async () => {
    seed();
    const summary = await api.getWalletSummary(userId, tenantId);
    assert.equal(summary.depositBalance, '350.50');
    assert.equal(summary.winningBalance, '120.00');
    assert.equal(summary.totalBalance, '470.50');
    assert.equal(summary.tenantId, tenantId);
  });

  it('returns the ledger newest first with amounts as strings', async () => {
    seed();
    const { ledger } = await api.getWalletSummary(userId, tenantId);
    assert.deepEqual(ledger.map((r) => r.id), ['l2', 'l3', 'l1']);
    assert.equal(ledger[0].amount, '50.00');
    assert.equal(ledger[0].balanceAfter, '150.00');
  });

  it('clamps pagination to sane bounds', async () => {
    seed();
    const clamped = await api.getWalletSummary(userId, tenantId, 0, 999);
    assert.equal(clamped.pagination.page, 1);
    assert.equal(clamped.pagination.limit, 50);
    assert.equal(clamped.pagination.total, 3);
  });

  it('pages through the ledger with skip/take', async () => {
    seed();
    const page2 = await api.getWalletSummary(userId, tenantId, 2, 2);
    assert.deepEqual(page2.ledger.map((r) => r.id), ['l1']);
    assert.equal(page2.pagination.page, 2);
  });

  it('throws 404 for a user outside the tenant', async () => {
    seed();
    await assert.rejects(() => api.getWalletSummary(userId, 'other-tenant'), /not found/i);
  });
});
