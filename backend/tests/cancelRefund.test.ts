/**
 * Cancelling a tournament must give every participant their entry fee back, to
 * the exact balance it was taken from, exactly once.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type TournamentApi = typeof import('../src/services/tournament.service.js');
let api: TournamentApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  mock.module('../src/services/slotLock.service.js', {
    namedExports: {
      clearTournamentRedis: async () => {},
      reserveSlot: async () => ({ ok: true }),
      releaseSlot: async () => {},
      getOccupiedSlots: async () => ({}),
      hydrateSlotsFromDb: async () => {},
      createTeam: async () => true,
      joinTeam: async () => ({ ok: true, teamId: 't' }),
      deleteTeam: async () => {},
      decrementTeamMembers: async () => {},
      generateTeamCode: () => '123456',
      getTeamMembers: async () => 1,
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
  api = await import('../src/services/tournament.service.js');
});

const tenantId = 'tenant-1';
const tournamentId = 'tour-1';
const admin = { userId: 'admin-1', tenantId, role: 'ADMIN' as const };

function seed(opts: { status?: string; fee?: number; joinBalanceType?: 'DEPOSIT' | 'WINNING' } = {}) {
  const fee = opts.fee ?? 25;
  fake = new FakePrisma({
    users: [
      { id: 'player-1', tenantId, depositBalance: 0, winningBalance: 0, playerCode: 'THU-0001' },
      { id: 'player-2', tenantId, depositBalance: 0, winningBalance: 0, playerCode: 'THU-0002' },
    ],
    tournaments: [
      {
        id: tournamentId,
        tenantId,
        title: 'Bermuda Solo #1',
        status: opts.status ?? 'OPEN',
        entryFee: fee,
        totalSlots: 48,
        matchType: 'SOLO',
        matchTime: new Date(Date.now() + 3_600_000),
      },
    ],
    tournamentSlots: [
      { id: 'slot-1', tournamentId, userId: 'player-1', slotNumber: 1 },
      { id: 'slot-2', tournamentId, userId: 'player-2', slotNumber: 2 },
    ],
    walletLedger: [
      {
        id: 'led-1',
        tenantId,
        userId: 'player-1',
        amount: fee,
        balanceType: opts.joinBalanceType ?? 'DEPOSIT',
        type: 'DEBIT',
        category: 'JOIN_FEE',
        referenceId: tournamentId,
        createdAt: new Date(),
      },
    ],
  });
  return fake;
}

describe('cancelTournamentAndRefundAll', () => {
  beforeEach(() => seed());

  it('refunds every participant to the balance the fee came from', async () => {
    const out = await api.cancelTournamentAndRefundAll(admin as any, tournamentId, 'server outage');

    assert.equal(out.refundedPlayers, 2);
    assert.equal(out.totalRefunded, 50, '2 x ₹25');
    assert.equal(out.status, 'CANCELLED');
    assert.equal(fake.rowsOf('tournament')[0].status, 'CANCELLED');

    const [p1, p2] = fake.rowsOf('user');
    assert.equal(p1.depositBalance, 25, 'player-1 paid from the deposit balance');
    assert.equal(p2.depositBalance, 25, 'no join ledger -> default deposit refund');

    const refunds = fake.rowsOf('walletLedger').filter((r) => r.category === 'REFUND');
    assert.equal(refunds.length, 2);
    for (const refund of refunds) {
      assert.equal(refund.type, 'CREDIT');
      assert.equal(refund.balanceType, 'DEPOSIT');
      assert.equal(Number(refund.amount), 25);
      assert.match(String(refund.notes), /server outage/);
    }
    assert.equal(Number(refunds[0].balanceAfter), 25);
  });

  it('refunds into the winning balance when the fee was paid from winnings', async () => {
    seed({ joinBalanceType: 'WINNING' });
    await api.cancelTournamentAndRefundAll(admin as any, tournamentId, 'not enough players');

    const p1 = fake.rowsOf('user')[0];
    assert.equal(p1.winningBalance, 25);
    assert.equal(p1.depositBalance, 0);
    assert.equal(fake.rowsOf('walletLedger').filter((r) => r.category === 'REFUND')[0].balanceType, 'WINNING');
  });

  it('refuses to cancel without a reason or in a non-cancellable status', async () => {
    await assert.rejects(
      () => api.cancelTournamentAndRefundAll(admin as any, tournamentId, '   '),
      /reason is required/i,
    );

    seed({ status: 'COMPLETED' });
    await assert.rejects(
      () => api.cancelTournamentAndRefundAll(admin as any, tournamentId, 'late'),
      /Cannot cancel a tournament in status COMPLETED/i,
    );
    assert.equal(fake.rowsOf('walletLedger').filter((r) => r.category === 'REFUND').length, 0);
  });

  it('keeps tenants isolated', async () => {
    await assert.rejects(
      () => api.cancelTournamentAndRefundAll({ ...admin, tenantId: 'other' } as any, tournamentId, 'x'),
      /Tournament not found/i,
    );
  });

  it('is safe to run twice (second call sees CANCELLED and refuses)', async () => {
    await api.cancelTournamentAndRefundAll(admin as any, tournamentId, 'first');
    await assert.rejects(
      () => api.cancelTournamentAndRefundAll(admin as any, tournamentId, 'second'),
      /Cannot cancel/i,
    );
    assert.equal(fake.rowsOf('walletLedger').filter((r) => r.category === 'REFUND').length, 2, 'no double refund');
  });
});
