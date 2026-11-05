import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type DepositApi = typeof import('../src/services/deposit.service.js');
let api: DepositApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/deposit.service.js');
});

const tenantId = 'tenant-1';
const userId = 'user-1';
const adminId = 'admin-1';

function seed(overrides: { user?: any; deposit?: any; tenant?: any } = {}) {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, minDeposit: 10, ...overrides.tenant }],
    users: [{ id: userId, tenantId, depositBalance: 100, winningBalance: 20, ...overrides.user }],
    depositRequests: overrides.deposit
      ? [{ id: 'dep-1', tenantId, userId, amount: 250, utrNumber: 'UTR123456789', status: 'PENDING', rejectionNote: null, reviewedAt: null, createdAt: new Date(), ...overrides.deposit }]
      : [],
  });
  return fake;
}

describe('submitDeposit', () => {
  beforeEach(() => seed());

  it('creates a PENDING request without crediting the wallet', async () => {
    const out = await api.submitDeposit(userId, tenantId, { amount: 500, utrNumber: ' utr123456789 ' });

    assert.equal(out.deposit.status, 'PENDING');
    assert.equal(out.deposit.amount, '500.00');
    assert.equal(out.deposit.utrNumber, 'UTR123456789');
    assert.equal(fake.rowsOf('walletLedger').length, 0, 'no money before admin approval');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100);
  });

  it('enforces the tenant minimum, the global maximum and UTR format', async () => {
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 5, utrNumber: 'UTR123456789' }), /Minimum deposit/i);
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 50_001, utrNumber: 'UTR123456789' }), /Maximum deposit/i);
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 100, utrNumber: 'SHORT' }), /12 letters/i);
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 0, utrNumber: 'UTR123456789' }), /valid deposit amount/i);
  });

  it('honours a custom tenant minimum deposit', async () => {
    seed({ tenant: { minDeposit: 500 } });
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 499, utrNumber: 'UTR123456789' }), /Minimum deposit is ₹500/);
    const ok = await api.submitDeposit(userId, tenantId, { amount: 500, utrNumber: 'UTR123456789' });
    assert.equal(ok.deposit.amount, '500.00');
  });

  it('rejects a UTR that is already pending or approved', async () => {
    seed({ deposit: { utrNumber: 'UTR123456789' } });
    await assert.rejects(
      () => api.submitDeposit(userId, tenantId, { amount: 250, utrNumber: 'UTR123456789' }),
      /already submitted/i,
    );
  });

  it('blocks banned players', async () => {
    seed({ user: { isBanned: true } });
    await assert.rejects(() => api.submitDeposit(userId, tenantId, { amount: 250, utrNumber: 'UTR123456789' }), /banned/i);
  });

  it('caps the number of pending requests (anti-spam)', async () => {
    fake = new FakePrisma({
      tenants: [{ id: tenantId, minDeposit: 10 }],
      users: [{ id: userId, tenantId }],
      depositRequests: Array.from({ length: 5 }, (_, i) => ({
        id: `dep-${i}`, tenantId, userId, amount: 100, utrNumber: `UTR00000000${i}`, status: 'PENDING', createdAt: new Date(),
      })),
    });
    await assert.rejects(
      () => api.submitDeposit(userId, tenantId, { amount: 250, utrNumber: 'UTR123456789' }),
      /several pending deposits/i,
    );
  });
});

describe('approveDeposit', () => {
  beforeEach(() => seed({ deposit: { amount: 250 } }));

  it('credits the wallet once and writes a ledger row', async () => {
    const out = await api.approveDeposit(adminId, tenantId, 'dep-1');

    assert.equal(out.deposit.status, 'APPROVED');
    assert.equal(out.depositBalance, 350);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 350);

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].referenceId, 'dep-1');
    assert.equal(Number(ledger[0].amount), 250);
    assert.equal(Number(ledger[0].balanceAfter), 350);
  });

  it('refuses to credit the same request twice', async () => {
    await api.approveDeposit(adminId, tenantId, 'dep-1');
    await assert.rejects(() => api.approveDeposit(adminId, tenantId, 'dep-1'), /already APPROVED/i);
    assert.equal(fake.rowsOf('walletLedger').length, 1);
    assert.equal(fake.rowsOf('user')[0].depositBalance, 350);
  });

  it('refuses requests from another tenant', async () => {
    await assert.rejects(() => api.approveDeposit(adminId, 'other-tenant', 'dep-1'), /not found/i);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('records who reviewed the request', async () => {
    await api.approveDeposit(adminId, tenantId, 'dep-1');
    const row = fake.rowsOf('depositRequest')[0];
    assert.equal(row.reviewedBy, adminId);
    assert.ok(row.reviewedAt instanceof Date);
  });
});

describe('rejectDeposit', () => {
  beforeEach(() => seed({ deposit: { amount: 250 } }));

  it('rejects a pending request and never credits', async () => {
    const out = await api.rejectDeposit(adminId, tenantId, 'dep-1', 'UTR not found in bank statement');
    assert.equal(out.deposit.status, 'REJECTED');
    assert.equal(out.deposit.rejectionNote, 'UTR not found in bank statement');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 100);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('requires a meaningful reason', async () => {
    await assert.rejects(() => api.rejectDeposit(adminId, tenantId, 'dep-1', 'no'), /at least 3 characters/i);
  });

  it('cannot reject an already approved deposit', async () => {
    await api.approveDeposit(adminId, tenantId, 'dep-1');
    await assert.rejects(() => api.rejectDeposit(adminId, tenantId, 'dep-1', 'too late'), /already APPROVED/i);
  });
});
