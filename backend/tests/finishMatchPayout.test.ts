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

function seed(
  opts: { status?: string; perKill?: number; winning?: number; slot?: boolean; seats?: number } = {},
) {
  const seats = opts.seats ?? 5;
  const otherSlots = Array.from({ length: seats - 1 }, (_, i) => ({
    id: `slot-x${i}`,
    tournamentId,
    userId: `other-${i}`,
    slotNumber: i + 2,
  }));
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
        perKillPrize: opts.perKill ?? 10,
        entryFee: 25,
        totalSlots: 48,
        matchType: 'SOLO',
        matchTime: new Date(),
      },
    ],
    tournamentSlots:
      opts.slot === false
        ? []
        : [{ id: 'slot-1', tournamentId, userId: winnerUserId, slotNumber: 1 }, ...otherSlots],
  });
  return fake;
}

describe('finishMatchAndPayWinner', () => {
  beforeEach(() => seed());

  it('pays the per-kill prize into the WINNING balance', async () => {
    const out = await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 4 } as any);

    assert.equal(out.totalPaid, 40, '4 x ₹10 kills, no placement prize');
    assert.equal(out.winner.killPrize, 40);
    assert.equal(out.status, 'COMPLETED');

    const winner = fake.rowsOf('user')[0];
    assert.equal(winner.winningBalance, 90, '₹50 + ₹40');
    assert.equal(winner.depositBalance, 0, 'prizes never land in the deposit balance');

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'CREDIT');
    assert.equal(ledger[0].category, 'WINNING_PRIZE');
    assert.equal(ledger[0].balanceType, 'WINNING');
    assert.equal(Number(ledger[0].amount), 40);
    assert.equal(Number(ledger[0].balanceAfter), 90);
    assert.equal(ledger[0].referenceId, tournamentId);

    assert.equal(fake.rowsOf('tournament')[0].status, 'COMPLETED');
    const result = fake.rowsOf('matchResult')[0];
    assert.equal(result.userId, winnerUserId);
    assert.equal(result.rank, 1);
    assert.equal(result.verifiedKills, 4);
    assert.equal(Number(result.prizeWon), 40);
    assert.equal(result.isApproved, true);
  });

  it('clamps kills to the lobby size so a typo cannot over-pay', async () => {
    seed({ seats: 101 });
    const out = await api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 5000 } as any);
    assert.equal(out.winner.kills, 99, 'capped at 99 kills');
    assert.equal(out.totalPaid, 99 * 10);
  });

  it('refuses a payout bigger than the entry fees collected', async () => {
    seed({ seats: 1, perKill: 30 });
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 2 } as any),
      /at most 0 kill/i,
    );
  });

  it('completes the match without a ledger row when the prize is zero', async () => {
    seed({ perKill: 0 });
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
    assert.equal(fake.rowsOf('walletLedger').length, 0, 'zero-kill winner pays nothing, twice');

    seed({ status: 'CANCELLED' });
    await assert.rejects(
      () => api.finishMatchAndPayWinner(staff, tournamentId, { winnerUid, winnerKills: 0 } as any),
      /cancelled/i,
    );
  });

  it('validates the winner UID and requires the player to have joined', async () => {
    seed({ slot: false });
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
