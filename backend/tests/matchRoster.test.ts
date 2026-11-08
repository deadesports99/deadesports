/**
 * Admin match roster (`matchRoster.service.ts`): join-time identity snapshots,
 * cheat flags, match-scoped bans, one-time prize payout and the CSV export.
 *
 * These are the money/access paths that had no coverage before — a regression
 * here pays a player twice or pays a banned cheat.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

let fake: FakePrisma;
let roster: typeof import('../src/services/matchRoster.service.js');

const tenantId = 'tenant-1';
const adminId = 'admin-1';
const playerId = 'player-1';
const matchId = 'match-1';

const staff = {
  userId: adminId,
  tenantId,
  role: 'ADMIN',
  canCreateMatch: true,
  canUpdateRoomId: true,
  canDistributePrize: true,
  canManageWallet: true,
} as any;

const NOW = new Date('2026-11-07T10:00:00.000Z');

function seed(overrides: { user?: any; slot?: any; match?: any } = {}): void {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, subdomain: 'apex-ff', brandName: 'Apex Free Fire Club' }],
    users: [
      { id: adminId, tenantId, phoneNumber: '9999900001', role: 'ADMIN', isBanned: false },
      {
        id: playerId,
        tenantId,
        phoneNumber: '9999900003',
        role: 'USER',
        name: 'Ravi',
        playerCode: 'APX-0003',
        inGameName: 'ProfileName',
        inGameUid: '2222222222',
        deviceId: 'device-a',
        depositBalance: 0,
        winningBalance: 0,
        isBanned: false,
        ...(overrides.user ?? {}),
      },
    ],
    tournaments: [
      {
        id: matchId,
        tenantId,
        matchNumber: 839,
        title: 'Bermuda Solo #839',
        mapType: 'BERMUDA',
        matchType: 'SOLO',
        status: 'OPEN',
        matchTime: NOW,
        entryFee: 20,
        prizePool: 1200,
        perKillPrize: 15,
        totalSlots: 48,
        roomId: null,
        roomPassword: null,
        ...(overrides.match ?? {}),
      },
    ],
    tournamentSlots: [
      {
        id: 'slot-1',
        tournamentId: matchId,
        userId: playerId,
        slotNumber: 1,
        teamId: null,
        joinedAt: NOW,
        inGameNameSnapshot: 'JoinName',
        inGameUidSnapshot: '1111111111',
        deviceIdSnapshot: 'device-a',
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
        ...(overrides.slot ?? {}),
      },
    ],
    matchResults: [],
  });
}

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  mock.module('../src/config/redis.js', {
    namedExports: {
      redis: {
        eval: async () => 0,
        hgetall: async () => ({}),
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        keys: async () => [],
        status: 'ready',
      },
      disconnectRedis: async () => {},
    },
  });
  roster = await import('../src/services/matchRoster.service.js');
});

beforeEach(() => seed());

const player = () => fake.rowsOf('user').find((u) => u.id === playerId)!;

describe('roster identity', () => {
  it('shows the join-time snapshot, not the newer profile values', async () => {
    const result = await roster.getMatchRoster(staff, matchId);
    const p = result.participants[0];
    assert.equal(p.inGameName, 'JoinName');
    assert.equal(p.inGameUid, '1111111111');
    // Profile changed after joining -> flagged for the admin, but history is intact.
    assert.ok(p.flags.some((f) => f.code === 'UID_MISMATCH'));
    assert.match(
      p.flags.find((f) => f.code === 'UID_MISMATCH')!.detail,
      /Joined with UID 1111111111, profile now 2222222222/,
    );
    assert.equal(result.summary.flagged, 1);
  });

  it('flags a participant who never gave a Free Fire UID', async () => {
    seed({ user: { inGameUid: null }, slot: { inGameUidSnapshot: null } });
    const result = await roster.getMatchRoster(staff, matchId);
    assert.ok(result.participants[0].flags.some((f) => f.code === 'NO_FF_UID'));
    assert.equal(result.summary.noUid, 1);
  });

  it('does not flag a clean participant', async () => {
    seed({ user: { inGameUid: '1111111111' } });
    const result = await roster.getMatchRoster(staff, matchId);
    assert.deepEqual(result.participants[0].flags, []);
  });
});

describe('match-scoped ban', () => {
  it('bans the player for this match while the account stays usable', async () => {
    const result = await roster.banMatchParticipant(staff, matchId, playerId, true, 'team kill');
    assert.equal(result.matchBanned, true);
    assert.equal(result.accountBanned, false);

    const slot = fake.rowsOf('tournamentSlot')[0];
    assert.equal(slot.isBanned, true);
    assert.equal(slot.banReason, 'team kill');
    assert.equal(slot.bannedBy, adminId);
    assert.equal(player().isBanned, false);
  });

  it('refuses a player who is not in the match', async () => {
    await assert.rejects(
      () => roster.banMatchParticipant(staff, matchId, 'someone-else', true, 'nope'),
      /not in the match/i,
    );
  });
});

describe('prize payout', () => {
  it('pays a rank + kill prize exactly once, even when the admin clicks twice', async () => {
    const award = { userId: playerId, rank: 1, kills: 3 };

    const first = await roster.payoutMatchAwards(staff, matchId, [award], false);
    assert.equal(first.playersPaid, 1);
    assert.equal(first.totalPaid, 645); // 50% of ₹1200 pool + 3 × ₹15
    assert.equal(Number(player().winningBalance), 645);
    assert.equal(fake.rowsOf('walletLedger').length, 1);

    const second = await roster.payoutMatchAwards(staff, matchId, [award], false);
    assert.equal(second.playersPaid, 0);
    assert.deepEqual(second.skipped, [{ userId: playerId, reason: 'already paid' }]);
    assert.equal(Number(player().winningBalance), 645, 'no second credit');
    assert.equal(fake.rowsOf('walletLedger').length, 1, 'no second ledger row');
  });

  it('never pays a match-banned player', async () => {
    seed({ slot: { isBanned: true, banReason: 'cheating' } });
    await assert.rejects(
      () => roster.payoutMatchAwards(staff, matchId, [{ userId: playerId, rank: 1 }], false),
      /banned from this match/i,
    );
    assert.equal(Number(player().winningBalance), 0);
  });

  it('rejects an award for someone who never joined', async () => {
    await assert.rejects(
      () => roster.payoutMatchAwards(staff, matchId, [{ userId: 'stranger', rank: 1 }], false),
      /not a participant/i,
    );
  });

  it('cannot pay out more than the prize pool', async () => {
    seed({ match: { prizePool: 100, perKillPrize: 0 } });
    await assert.rejects(
      () => roster.payoutMatchAwards(staff, matchId, [{ userId: playerId, amount: 500 }], false),
      /Prize budget exceeded/i,
    );
  });

  it('records a disqualification with zero money', async () => {
    const result = await roster.payoutMatchAwards(
      staff,
      matchId,
      [{ userId: playerId, isDisqualified: true, disqualifyReason: 'aimbot' }],
      false,
    );
    assert.equal(result.totalPaid, 0);
    const saved = fake.rowsOf('matchResult')[0];
    assert.equal(saved.isDisqualified, true);
    assert.equal(Number(saved.prizeWon), 0);
    assert.equal(Number(player().winningBalance), 0);
  });
});

describe('roster CSV export', () => {
  it('quotes commas and doubles inner quotes', async () => {
    // The CSV must escape the *snapshot* name (that is what the admin sees).
    seed({ slot: { inGameNameSnapshot: 'A,B"C', inGameUidSnapshot: '1111111111' } });
    const data = await roster.getMatchRoster(staff, matchId);
    const csv = roster.buildRosterCsv(data);
    assert.ok(csv.includes('"A,B""C"'), 'IGN with comma/quote must be escaped');
    assert.ok(csv.includes('1111111111'), 'FF UID column carries the snapshot');
  });
});
