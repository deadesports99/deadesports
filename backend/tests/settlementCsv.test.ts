import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSettlementCsv } from '../src/services/settlement.service.js';

type Settlement = Parameters<typeof buildSettlementCsv>[0];

function fixture(overrides: Partial<Settlement> = {}): Settlement {
  return {
    summary: {
      date: '2026-11-05',
      totalDeposits: 1500,
      depositCount: 3,
      totalWithdrawals: 200,
      withdrawalCount: 1,
      totalMatchRevenue: 900,
      matchCount: 6,
      totalPrizesPaid: 700,
      prizeCount: 2,
      netOrganizerProfit: 500,
      commissionRate: 10,
      platformCut: 90,
    },
    transactions: [
      {
        createdAt: new Date('2026-11-05T10:15:30.000Z'),
        player: { name: 'Ravi Kumar', phoneNumber: '919999900001', inGameName: 'RaVi' },
        category: 'ADD_MONEY',
        type: 'CREDIT',
        balanceType: 'DEPOSIT',
        amount: 500,
        balanceAfter: 1500,
        referenceId: 'UTR123',
        notes: 'UPI top-up',
      },
    ],
    ...overrides,
  } as unknown as Settlement;
}

describe('buildSettlementCsv', () => {
  it('starts with the summary block, then a blank line, then the ledger header', () => {
    const rows = buildSettlementCsv(fixture()).split('\r\n');
    assert.equal(rows[0], 'Daily Settlement Report,2026-11-05');
    assert.equal(rows[1], 'Total Deposits (Approved),1500.00,3');
    assert.equal(rows[2], 'Total Withdrawals (Approved),200.00,1');
    assert.equal(rows[3], 'Total Entry Fees Collected,900.00,6 match(es)');
    assert.equal(rows[4], 'Total Prizes Paid,700.00,2');
    assert.equal(rows[5], 'Net Organizer Profit,500.00');
    assert.equal(rows[6], 'Platform Cut (10%),90.00');
    assert.equal(rows[7], '');
    assert.match(rows[8], /Date|Time|Player/);
  });

  it('writes one ledger row per transaction with amounts fixed to 2 decimals', () => {
    const csv = buildSettlementCsv(fixture());
    const rows = csv.split('\r\n');
    const ledger = rows[9];
    assert.match(ledger, /^1,2026-11-05,10:15:30,/);
    assert.match(ledger, /500\.00/);
    assert.match(ledger, /1500\.00/);
  });

  it('quotes values containing commas, quotes or newlines (CSV safety)', () => {
    const base = fixture();
    const csv = buildSettlementCsv({
      ...base,
      transactions: [
        {
          ...base.transactions[0],
          player: { name: 'Kumar, Ravi', phoneNumber: '919999900001', inGameName: 'Ra"Vi' },
          notes: 'line1\nline2',
        },
      ],
    } as unknown as Settlement);
    assert.match(csv, /"Kumar, Ravi"/);
    assert.match(csv, /"Ra""Vi"/);
    assert.match(csv, /"line1\nline2"/);
  });

  it('emits an empty ledger when there are no transactions', () => {
    const rows = buildSettlementCsv(fixture({ transactions: [] } as unknown as Partial<Settlement>)).split('\r\n');
    assert.equal(rows.length, 9, 'summary + blank + header only');
  });
});
