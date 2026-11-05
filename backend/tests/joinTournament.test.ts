import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
let locks: string[];
type TournamentApi = typeof import('../src/services/tournament.service.js');
let api: TournamentApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  // Redis-backed seat lock is unit-tested separately; here we only verify the
  // database/money behaviour of the join flow.
  mock.module('../src/services/slotLock.service.js', {
    namedExports: {
      reserveSlot: async () => { locks.push('reserve'); return { ok: true }; },
      releaseSlot: async () => { locks.push('release'); },
      createTeam: async () => true,
      joinTeam: async () => ({ ok: true, teamId: 'team-1' }),
      deleteTeam: async () => { locks.push('deleteTeam'); },
      decrementTeamMembers: async () => {},
      generateTeamCode: () => '123456',
      getOccupiedSlots: async () => ({}),
      hydrateSlotsFromDb: async () => {},
      clearTournamentRedis: async () => {},
      getTeamMembers: async () => 1,
    },
  });
  mock.module('../src/services/fcm.service.js', {
    namedExports: {
      pushToTournamentParticipants: async () => {},
      pushToUsers: async () => {},
      pushToUser: async () => {},
    },
  });
  mock.module('../src/services/realtime.service.js', {
    namedExports: {
      realtimeService: {
        broadcast: () => {}, broadcastToTenant: () => {}, sendToUser: () => {}, sendToUsers: () => {},
      },
    },
  });
  api = await import('../src/services/tournament.service.js');
});

const tenantId = 'tenant-1';
const userId = 'user-1';
const tournamentId = 'tour-1';

const user = { userId, tenantId, role: 'USER' } as any;

function seed(opts: { deposit?: number; winning?: number; entryFee?: number; slots?: any[]; status?: string } = {}) {
  locks = [];
  fake = new FakePrisma({
    users: [{ id: userId, tenantId, depositBalance: opts.deposit ?? 100, winningBalance: opts.winning ?? 0, isBanned: false }],
    tournaments: [{
      id: tournamentId, tenantId, title: 'Bermuda Solo #1', status: opts.status ?? 'OPEN',
      matchType: 'SOLO', entryFee: opts.entryFee ?? 25, totalSlots: 48, visibleFrom: null,
      matchTime: new Date(Date.now() + 3_600_000),
    }],
    tournamentSlots: opts.slots ?? [],
  });
  return fake;
}

describe('joinTournament — entry fee on the money path', () => {
  beforeEach(() => seed());

  it('debits the entry fee from the deposit balance and writes a JOIN_FEE ledger row', async () => {
    const out = await api.joinTournament(user, tournamentId, 7);

    assert.equal(out.slotNumber, 7);
    assert.equal(out.entryFee, 25);
    assert.equal(out.balanceAfter, 75);

    const row = fake.rowsOf('user')[0];
    assert.equal(row.depositBalance, 75);
    assert.equal(row.winningBalance, 0, 'deposit money is used first');

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'DEBIT');
    assert.equal(ledger[0].category, 'JOIN_FEE');
    assert.equal(ledger[0].balanceType, 'DEPOSIT');
    assert.equal(Number(ledger[0].amount), 25);
    assert.equal(Number(ledger[0].balanceAfter), 75);
    assert.equal(ledger[0].referenceId, tournamentId);

    assert.equal(fake.rowsOf('tournamentSlot').length, 1);
    assert.equal(fake.rowsOf('tournamentSlot')[0].slotNumber, 7);
  });

  it('falls back to the winning balance when the deposit balance is short', async () => {
    seed({ deposit: 10, winning: 100, entryFee: 25 });
    const out = await api.joinTournament(user, tournamentId, 3);

    const row = fake.rowsOf('user')[0];
    assert.equal(row.depositBalance, 10, 'deposit balance untouched');
    assert.equal(row.winningBalance, 75);
    assert.equal(fake.rowsOf('walletLedger')[0].balanceType, 'WINNING');
    assert.equal(out.balanceAfter, 85);
  });

  it('refuses to join without enough money and releases the seat', async () => {
    seed({ deposit: 5, winning: 5, entryFee: 25 });
    await assert.rejects(() => api.joinTournament(user, tournamentId, 1), /Insufficient balance/i);

    assert.equal(fake.rowsOf('walletLedger').length, 0, 'no ledger row on failure');
    assert.equal(fake.rowsOf('tournamentSlot').length, 0, 'no seat on failure');
    assert.equal(fake.rowsOf('user')[0].depositBalance, 5);
    assert.ok(locks.includes('release'), 'redis seat must be released');
  });

  it('flips the match to SLOTS_FULL when the last seat is taken', async () => {
    seed({ slots: [{ id: 's1', tournamentId, userId: 'other', slotNumber: 1 }], deposit: 500 });
    fake.rowsOf('tournament')[0].totalSlots = 2;

    const out = await api.joinTournament(user, tournamentId, 2);
    assert.equal(out.tournamentStatus, 'SLOTS_FULL');
    assert.equal(fake.rowsOf('tournament')[0].status, 'SLOTS_FULL');
  });

  it('rejects closed matches and hidden (future visibility) matches', async () => {
    seed({ status: 'COMPLETED' });
    await assert.rejects(() => api.joinTournament(user, tournamentId, 1), /not accepting entries/i);

    seed();
    fake.rowsOf('tournament')[0].visibleFrom = new Date(Date.now() + 600_000);
    await assert.rejects(() => api.joinTournament(user, tournamentId, 1), /not open yet/i);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('rejects invalid slot numbers and unknown tournaments', async () => {
    await assert.rejects(() => api.joinTournament(user, tournamentId, 99), /slotNumber must be between/i);
    await assert.rejects(() => api.joinTournament(user, 'ghost', 1), /Tournament not found/i);
    assert.equal(fake.rowsOf('walletLedger').length, 0);
  });

  it('auto-picks the first free seat when no slot number is given', async () => {
    seed({ slots: [{ id: 's1', tournamentId, userId: 'other', slotNumber: 1 }] });
    const out = await api.joinTournament(user, tournamentId);
    assert.equal(out.slotNumber, 2);
  });
});
