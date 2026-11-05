import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type ResultApi = typeof import('../src/services/result.service.js');
let api: ResultApi;

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
      pushToUsers: async () => {},
      pushToUser: async () => {},
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
  api = await import('../src/services/result.service.js');
});

const tenantId = 'tenant-1';
const winnerUserId = 'user-winner';
const winnerUid = '123456789';
const tournamentId = 'tour-1';
const staff = { userId: 'admin-1', tenantId, role: 'ADMIN' } as any;

function seed(opts: { status?: string; pool?: number; perKill?: number; winning?: number; slot?: boolean } = {}) {
  fake = new FakePrisma({
    users: [
      {
        id: winnerUserId,
        tenantId,
        winningBalance: opts.winning ?? 50,
        depositBalance: 0,
        inGameUid: winnerUid,
        inGameName: 'Winner',
        playerCode: 'THU-0001',
      },
    ],
    tournaments: [
      {
        id: tournamentId,
        tenantId,
        title: 'Bermuda Solo #1',
        status: opts.status ?? 'LIVE',
        prizePool: opts.pool ?? 400,
        perKillPrize: opts.perKill ?? 10,
        entryFee: 25,
        totalSlots: 48,
        matchType: 'SOLO',
        matchTime: new Date(),
      },
    ],
    tournamentSlots:
      opts.slot === false ? [] : [{ id: 'slot-1', tournamentId, userId: winnerUserId, slotNumber: 5 }],
  });
  return fake;
}

describe('finishMatchAndPayWinner', () => {
  beforeEach(() => seed());

  it('pays 50% of the pool plus per-kill prize into the WINNING balance', async () => {
    const out = await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 4 } as any);

    assert.equal(out.totalPaid, 240, '₹200 rank + 4x ₹10 kills');
    assert.equal(out.winner.rankPrize, 200);
    assert.equal(out.winner.killPrize, 40);
    assert.equal(out.status, 'COMPLETED');

    const winner = fake.rowsOf('user')[0];
    assert.equal(winner.winningBalance, 290, '₹50 + ₹240');
    assert.equal(winner.depositBalance, 0, 'prizes never land in the deposit balance');

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'CREDIT');
    assert.equal(ledger[0].category, 'WINNING_PRIZE');
    assert.equal(ledger[0].balanceType, 'WINNING');
    assert.equal(Number(ledger[0].amount), 240);
    assert.equal(Number(ledger[0].balanceAfter), 290);
    assert.equal(ledger[0].referenceId, tournamentId);

    assert.equal(fake.rowsOf('tournament')[0].status, 'COMPLETED');
    const result = fake.rowsOf('matchResult')[0];
    assert.equal(result.userId, winnerUserId);
    assert.equal(result.rank, 1);
    assert.equal(result.verifiedKills, 4);
    assert.equal(Number(result.prizeWon), 240);
    assert.equal(result.isApproved, true);
  });

  it('clamps kills to 0..99 so a typo cannot over-pay', async () => {
    const out = await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 5000 } as any);
    assert.equal(out.winner.kills, 99);
    assert.equal(out.totalPaid, 200 + 99 * 10);
  });

  it('completes the match without a ledger row when the prize is zero', async () => {
    seed({ pool: 0, perKill: 0 });
    const out = await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 0 } as any);
    assert.equal(out.totalPaid, 0);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
    assert.equal(fake.rowsOf('tournament')[0].status, 'COMPLETED');
  });

  it('refuses to pay twice or to touch cancelled matches', async () => {
    await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 0 } as any);
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 0 } as any),
      /already completed/i,
    );
    assert.equal(fake.rowsOf('walletLedger').length, 1, 'no double payout');

    seed({ status: 'CANCELLED' });
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 0 } as any),
      /cancelled/i,
    );
  });

  it('validates the winner UID and requires the player to have joined', async () => {
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid: '12ab', winnerKills: 0 } as any),
      /6-12 digit/i,
    );
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid: '999999999', winnerKills: 0 } as any),
      /No participant/i,
    );
    await assert.rejects(
      () =>
        api.finishMatchAndPayWinner({ ...staff, tenantId: 'other' }, tournamentId, {
          winnerUid,
          winnerKills: 0,
        } as any),
      /Tournament not found/i,
    );
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });
});
