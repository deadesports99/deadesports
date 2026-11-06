/**
 * The owner's daily P&L ("aaj kitna kamaya"): deposits in, withdrawals out,
 * entry-fee revenue per scheduled match, prize money out, platform commission —
 * and the same numbers as a spreadsheet-ready CSV.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type SettlementApi = typeof import('../src/services/settlement.service.js');
let api: SettlementApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/settlement.service.js');
});

const tenantId = 'tenant-1';
const DAY = '2026-03-15';
const at = (h: number, m = 0) => new Date(`2026-03-15T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
const otherDay = new Date('2026-03-14T12:00:00.000Z');

const players = [
  { id: 'p1', tenantId, name: 'Ravi', inGameName: 'FF|Ravi', phoneNumber: '9999900001', depositBalance: 0, winningBalance: 0 },
  { id: 'p2', tenantId, name: 'Aman', inGameName: 'FF|Aman', phoneNumber: '9999900002', depositBalance: 0, winningBalance: 0 },
];

function seed(over: { commissionRate?: number } = {}) {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, brandName: 'Thunder', isActive: true, commissionRate: over.commissionRate ?? 10 }],
    users: players,
    tournaments: [
      { id: 'tour-1', tenantId, title: 'Solo #1', status: 'COMPLETED', matchTime: at(18), entryFee: 25, prizePool: 400, perKillPrize: 10, totalSlots: 48, matchType: 'SOLO' },
      { id: 'tour-2', tenantId, title: 'Solo #2', status: 'COMPLETED', matchTime: at(20), entryFee: 25, prizePool: 400, perKillPrize: 10, totalSlots: 48, matchType: 'SOLO' },
      { id: 'tour-yesterday', tenantId, title: 'Old', status: 'COMPLETED', matchTime: otherDay, entryFee: 25, prizePool: 0, perKillPrize: 0, totalSlots: 48, matchType: 'SOLO' },
    ],
    depositRequests: [
      { id: 'd1', tenantId, userId: 'p1', amount: 500, status: 'APPROVED', reviewedAt: at(10) },
      { id: 'd2', tenantId, userId: 'p2', amount: 250, status: 'APPROVED', reviewedAt: at(11) },
      { id: 'd3', tenantId, userId: 'p1', amount: 999, status: 'APPROVED', reviewedAt: otherDay },
      { id: 'd4', tenantId, userId: 'p1', amount: 777, status: 'PENDING', reviewedAt: null },
    ],
    withdrawalRequests: [
      { id: 'w1', tenantId, userId: 'p1', amount: 300, status: 'APPROVED', reviewedAt: at(12) },
      { id: 'w2', tenantId, userId: 'p2', amount: 150, status: 'REJECTED', reviewedAt: at(12) },
    ],
    walletLedger: [
      { id: 'l1', tenantId, userId: 'p1', amount: 25, type: 'DEBIT', category: 'JOIN_FEE', balanceType: 'DEPOSIT', balanceAfter: 475, referenceId: 'tour-1', createdAt: at(9) },
      { id: 'l2', tenantId, userId: 'p2', amount: 25, type: 'DEBIT', category: 'JOIN_FEE', balanceType: 'DEPOSIT', balanceAfter: 225, referenceId: 'tour-1', createdAt: at(9, 5) },
      { id: 'l3', tenantId, userId: 'p2', amount: 25, type: 'DEBIT', category: 'JOIN_FEE', balanceType: 'DEPOSIT', balanceAfter: 200, referenceId: 'tour-2', createdAt: at(9, 6) },
      { id: 'l4', tenantId, userId: 'p1', amount: 240, type: 'CREDIT', category: 'WINNING_PRIZE', balanceType: 'WINNING', balanceAfter: 240, referenceId: 'tour-1', createdAt: at(19) },
      { id: 'l5', tenantId, userId: 'p1', amount: 500, type: 'CREDIT', category: 'DEPOSIT', balanceType: 'DEPOSIT', balanceAfter: 975, referenceId: 'd1', createdAt: at(10) },
      { id: 'l6', tenantId, userId: 'p1', amount: 25, type: 'DEBIT', category: 'JOIN_FEE', balanceType: 'DEPOSIT', balanceAfter: 950, referenceId: 'tour-yesterday', createdAt: otherDay },
    ],
    emailOtps: [],
  });
  return fake;
}

describe('getDailySettlement', () => {
  beforeEach(() => seed());

  it('totals money in, money out and the organizer margin', async () => {
    const { summary } = await api.getDailySettlement(tenantId, DAY);
    assert.equal(summary.date, DAY);
    assert.equal(summary.totalDeposits, 750, '₹500 + ₹250 approved today');
    assert.equal(summary.depositCount, 2, 'yesterday + pending ignored');
    assert.equal(summary.totalWithdrawals, 300);
    assert.equal(summary.withdrawalCount, 1, 'rejected withdrawal is not money out');
    assert.equal(summary.totalMatchRevenue, 75, '3 x ₹25 entry fees for today`s matches');
    assert.equal(summary.matchCount, 2, 'two distinct matches');
    assert.equal(summary.totalPrizesPaid, 240);
    assert.equal(summary.prizeCount, 1);
    assert.equal(summary.netOrganizerProfit, -165, '₹75 in - ₹240 out');
    assert.equal(summary.commissionRate, 10);
    assert.equal(summary.platformCut, -16.5, '10% of the margin');
  });

  it('uses the tenant commission rate', async () => {
    seed({ commissionRate: 20 });
    const { summary } = await api.getDailySettlement(tenantId, DAY);
    assert.equal(summary.commissionRate, 20);
    assert.equal(summary.platformCut, -33);
  });

  it('lists the day ledger with the player attached, oldest first', async () => {
    const { transactions } = await api.getDailySettlement(tenantId, DAY);

    assert.deepEqual(transactions.map((t) => t.id), ['l1', 'l2', 'l3', 'l5', 'l4'], 'clock order');
    assert.equal(transactions[0].player.phoneNumber, '9999900001');
    assert.equal(transactions[0].player.inGameName, 'FF|Ravi');
    assert.equal(transactions[0].amount, 25);
    assert.equal(transactions[0].balanceAfter, 475);
  });

  it('is empty (not broken) on a day with no movement', async () => {
    const { summary, transactions } = await api.getDailySettlement(tenantId, '2026-04-01');
    assert.equal(summary.totalDeposits, 0);
    assert.equal(summary.totalMatchRevenue, 0);
    assert.equal(summary.netOrganizerProfit, 0);
    assert.deepEqual(transactions, []);
  });

  it('validates the date format', async () => {
    await assert.rejects(() => api.getDailySettlement(tenantId, '15-03-2026'), /YYYY-MM-DD/);
    await assert.rejects(() => api.getDailySettlement(tenantId, '2026-13-01'), /valid calendar date/);
  });

  it('exports the same numbers as CSV', async () => {
    const settlement = await api.getDailySettlement(tenantId, DAY);
    const csv = api.buildSettlementCsv(settlement);

    assert.match(csv, /Daily Settlement Report/);
    assert.ok(csv.includes('S.No,Date,Time,Player,Phone,In-Game Name'), 'ledger header present');
    assert.ok(csv.includes('750'), 'deposit total appears in the summary block');
    assert.ok(csv.includes('FF|Ravi'));
    assert.equal(csv.includes('tour-yesterday'), false, 'other days never leak into the export');
  });
});
