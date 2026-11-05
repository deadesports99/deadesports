import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type WithdrawalApi = typeof import('../src/services/withdrawal.service.js');
let api: WithdrawalApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/withdrawal.service.js');
});

const tenantId = 'tenant-1';
const userId = 'user-1';
const adminId = 'admin-1';

function seed(opts: { winning?: number; deposit?: number; banned?: boolean; request?: any } = {}) {
  fake = new FakePrisma({
    users: [{
      id: userId, tenantId, depositBalance: opts.deposit ?? 500,
      winningBalance: opts.winning ?? 200, isBanned: opts.banned ?? false,
    }],
    withdrawalRequests: opts.request
      ? [{ id: 'wd-1', tenantId, userId, amount: 100, upiId: 'player@okaxis', status: 'PENDING', createdAt: new Date(), ...opts.request }]
      : [],
  });
  return fake;
}

describe('requestWithdrawal', () => {
  beforeEach(() => seed());

  it('holds the money from the WINNING balance and queues the payout', async () => {
    const out = await api.requestWithdrawal(userId, tenantId, { amount: 150, upiId: 'player@okaxis' });

    assert.equal(out.winningBalance, 50);
    const user = fake.rowsOf('user')[0];
    assert.equal(user.winningBalance, 50);
    assert.equal(user.depositBalance, 500, 'deposit (top-up) money is never used for payouts');

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'DEBIT');
    assert.equal(ledger[0].category, 'WITHDRAWAL');
    assert.equal(ledger[0].balanceType, 'WINNING');
    assert.equal(Number(ledger[0].balanceAfter), 50);

    const req = fake.rowsOf('withdrawalRequest')[0];
    assert.equal(req.status, 'PENDING');
    assert.equal(req.upiId, 'player@okaxis');
  });

  it('refunds nothing and rejects an over-balance request', async () => {
    await assert.rejects(
      () => api.requestWithdrawal(userId, tenantId, { amount: 500, upiId: 'player@okaxis' }),
      /Insufficient winning balance/i,
    );
    assert.equal(fake.rowsOf('user')[0].winningBalance, 200);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('validates the UPI id and the minimum amount', async () => {
    await assert.rejects(() => api.requestWithdrawal(userId, tenantId, { amount: 100, upiId: 'not-a-upi' }), /Invalid UPI ID/i);
    await assert.rejects(() => api.requestWithdrawal(userId, tenantId, { amount: 49, upiId: 'ab@okaxis' }), /Minimum withdrawal/i);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('blocks banned players from withdrawing', async () => {
    seed({ banned: true });
    await assert.rejects(
      () => api.requestWithdrawal(userId, tenantId, { amount: 100, upiId: 'player@okaxis' }),
      /Insufficient winning balance/i,
    );
    assert.equal(fake.rowsOf('user')[0].winningBalance, 200);
  });
});

describe('approveWithdrawal', () => {
  beforeEach(() => seed({ request: { utrNumber: null, rejectionNote: null } }));

  it('marks the payout paid with its UTR and does not touch balances', async () => {
    const out = await api.approveWithdrawal(adminId, tenantId, 'wd-1', 'UTR998877');

    assert.equal(out.withdrawal.status, 'APPROVED');
    assert.equal(out.withdrawal.utrNumber, 'UTR998877');
    assert.equal(fake.rowsOf('user')[0].winningBalance, 200, 'already held at request time');
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('requires a real UTR and a pending request', async () => {
    await assert.rejects(() => api.approveWithdrawal(adminId, tenantId, 'wd-1', '123'), /at least 6 characters/i);
    await assert.rejects(() => api.approveWithdrawal(adminId, 'other-tenant', 'wd-1', 'UTR998877'), /not found/i);

    await api.approveWithdrawal(adminId, tenantId, 'wd-1', 'UTR998877');
    await assert.rejects(() => api.approveWithdrawal(adminId, tenantId, 'wd-1', 'UTR998877'), /already APPROVED/i);
  });
});

describe('rejectWithdrawal', () => {
  beforeEach(() => seed({ request: { utrNumber: null, rejectionNote: null } }));

  it('refunds the held money to the winning balance', async () => {
    const out = await api.rejectWithdrawal(adminId, tenantId, 'wd-1', 'UPI handle invalid');

    assert.equal(out.winningBalance, 300, '₹200 held + ₹100 refunded');
    assert.equal(fake.rowsOf('user')[0].winningBalance, 300);

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'CREDIT');
    assert.equal(ledger[0].category, 'REFUND');
    assert.equal(ledger[0].referenceId, 'wd-1');
    assert.equal(fake.rowsOf('withdrawalRequest')[0].status, 'REJECTED');
  });

  it('requires a reason and a pending request', async () => {
    await assert.rejects(() => api.rejectWithdrawal(adminId, tenantId, 'wd-1', 'no'), /at least 3 characters/i);
    await api.rejectWithdrawal(adminId, tenantId, 'wd-1', 'bad upi');
    await assert.rejects(() => api.rejectWithdrawal(adminId, tenantId, 'wd-1', 'late'), /already REJECTED/i);
    assert.equal(fake.rowsOf('walletLedger').length, 1, 'refund happens exactly once');
  });
});
