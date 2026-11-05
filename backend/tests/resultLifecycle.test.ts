/**
 * Room reveal + results/payout lifecycle:
 *   admin sets credentials -> chooses when players may see them -> players read
 *   -> admin submits results -> prizes credited once, DQ players get nothing.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type ResultApi = typeof import('../src/services/result.service.js');
let api: ResultApi;

const broadcasts: string[] = [];
const direct: Array<{ userIds: string[]; event: string }> = [];
const pushes: Array<{ type: string }> = [];

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
      pushToTournamentParticipants: async (_id: string, payload: any) => {
        pushes.push({ type: payload.type });
      },
    },
  });
  mock.module('../src/services/realtime.service.js', {
    namedExports: {
      realtimeService: {
        broadcast: (event: string) => broadcasts.push(event),
        broadcastToTenant: (_t: string, event: string) => broadcasts.push(event),
        sendToUser: () => {},
        sendToUsers: (userIds: string[], event: string) => direct.push({ userIds, event }),
      },
    },
  });
  api = await import('../src/services/result.service.js');
});

const tenantId = 'tenant-1';
const tournamentId = 'tour-1';
const admin = { userId: 'admin-1', tenantId, role: 'ADMIN' as const };
const player = (id: string) => ({ userId: id, tenantId, role: 'USER' as const });

const inMinutes = (n: number) => new Date(Date.now() + n * 60_000);

function seed(over: Record<string, unknown> = {}, slots = true) {
  fake = new FakePrisma({
    users: [
      { id: 'player-1', tenantId, inGameName: 'FF|Ravi', inGameUid: '123456789', depositBalance: 0, winningBalance: 0 },
      { id: 'player-2', tenantId, inGameName: 'FF|Aman', inGameUid: '987654321', depositBalance: 0, winningBalance: 0 },
    ],
    tournaments: [
      {
        id: tournamentId,
        tenantId,
        title: 'Bermuda Solo #1',
        status: 'OPEN',
        matchType: 'SOLO',
        gameMode: 'BR',
        mapType: 'BERMUDA',
        entryFee: 25,
        totalSlots: 48,
        prizePool: 400,
        perKillPrize: 10,
        matchTime: inMinutes(120),
        roomRevealMinutes: 15,
        roomRevealedAt: null,
        roomId: null,
        roomPassword: null,
        ...over,
      },
    ],
    tournamentSlots: slots
      ? [
          { id: 'slot-1', tournamentId, userId: 'player-1', slotNumber: 1 },
          { id: 'slot-2', tournamentId, userId: 'player-2', slotNumber: 2 },
        ]
      : [],
  });
  return fake;
}

describe('room credentials lifecycle', () => {
  beforeEach(() => {
    broadcasts.length = 0;
    direct.length = 0;
    pushes.length = 0;
    seed();
  });

  it('publishes credentials without revealing them when the window is closed', async () => {
    const out = await api.updateRoomCredentials(admin as any, tournamentId, ' 88221144 ', ' ff2026 ', false);

    assert.equal(out.room.roomId, '88221144', 'trimmed');
    assert.equal(out.status, 'OPEN');
    assert.equal(fake.rowsOf('tournament')[0].roomRevealedAt, null);
    assert.equal(pushes.length, 0, 'no reveal alert yet');
  });

  it('reveals immediately (and notifies participants) when revealNow is set', async () => {
    const out = await api.updateRoomCredentials(admin as any, tournamentId, '88221144', 'ff2026', true);

    assert.equal(out.status, 'ROOM_REVEALED');
    assert.ok(fake.rowsOf('tournament')[0].roomRevealedAt instanceof Date);
    assert.ok(broadcasts.includes('MATCH_STATUS_CHANGED'));
    assert.deepEqual(direct.find((d) => d.event === 'ROOM_CREDENTIALS_REVEALED')?.userIds.sort(), [
      'player-1',
      'player-2',
    ]);
    assert.equal(pushes.filter((p) => p.type === 'ROOM_REVEALED').length, 1);
  });

  it('auto-reveals when the admin window is already open', async () => {
    seed({ matchTime: inMinutes(5) }); // 15 min window -> already open
    const out = await api.updateRoomCredentials(admin as any, tournamentId, '11112222', 'pw');
    assert.equal(out.status, 'ROOM_REVEALED');
  });

  it('refuses to touch finished or foreign tournaments', async () => {
    seed({ status: 'COMPLETED' });
    await assert.rejects(
      () => api.updateRoomCredentials(admin as any, tournamentId, '1', 'p'),
      /Cannot update room for a COMPLETED tournament/i,
    );

    seed();
    await assert.rejects(
      () => api.updateRoomCredentials({ ...admin, tenantId: 'other' } as any, tournamentId, '1', 'p'),
      /Tournament not found/i,
    );
  });

  it('lets the admin change the reveal window', async () => {
    const out = await api.updateRoomReveal(admin as any, tournamentId, { roomRevealMinutes: 45 });
    assert.equal(fake.rowsOf('tournament')[0].roomRevealMinutes, 45);
    assert.equal(out.hasCredentials, false);
    assert.equal(out.status, 'OPEN');

    await assert.rejects(
      () => api.updateRoomReveal(admin as any, tournamentId, { roomRevealMinutes: 0 }),
      /between 1 and 10080/i,
    );
    await assert.rejects(
      () => api.updateRoomReveal(admin as any, tournamentId, { roomRevealMinutes: 20_000 }),
      /between 1 and 10080/i,
    );
  });

  it('cannot reveal before the credentials exist, and not after kickoff', async () => {
    await assert.rejects(
      () => api.updateRoomReveal(admin as any, tournamentId, { revealNow: true }),
      /Publish the Room ID & Password first/i,
    );

    seed({ status: 'LIVE', roomId: '1', roomPassword: 'p' });
    await assert.rejects(
      () => api.updateRoomReveal(admin as any, tournamentId, { roomRevealMinutes: 30 }),
      /only be changed before the match starts/i,
    );
  });

  it('gates player access until the reveal window opens', async () => {
    seed({ roomId: '88221144', roomPassword: 'ff2026', matchTime: inMinutes(120) });

    const early = await api.getRoomCredentials(player('player-1') as any, tournamentId).catch((e) => e);
    assert.equal(early.statusCode, 403);
    assert.match(early.message, /revealed 15 minutes before match start/i);
    assert.ok(early.details.secondsUntilReveal > 0);

    await assert.rejects(
      () => api.getRoomCredentials(player('outsider') as any, tournamentId),
      /Only confirmed participants/i,
    );

    // Staff bypass the timer.
    const staff = await api.getRoomCredentials(admin as any, tournamentId);
    assert.equal(staff.roomId, '88221144');
    assert.equal(staff.roomUnlocked, true);

    seed({ roomId: '88221144', roomPassword: 'ff2026', matchTime: inMinutes(5) });
    const opened = await api.getRoomCredentials(player('player-1') as any, tournamentId);
    assert.equal(opened.roomPassword, 'ff2026');
    assert.equal(opened.secondsUntilReveal, 0);
  });

  it('says clearly when credentials are not published yet', async () => {
    await assert.rejects(
      () => api.getRoomCredentials(player('player-1') as any, tournamentId),
      /have not been set yet/i,
    );
  });
});

describe('results + 1-click payout', () => {
  beforeEach(() => {
    broadcasts.length = 0;
    seed();
  });

  it('pays 50 / 30 / 20 percent of the pool plus per-kill money', async () => {
    const out = await api.distributeTournamentPrizes(admin as any, tournamentId, [
      { userId: 'player-1', verifiedKills: 5, rank: 1 },
      { userId: 'player-2', verifiedKills: 2, rank: 2 },
    ]);

    assert.equal(out.playersPaid, 2);
    assert.equal(out.totalPaid, 200 + 50 + 120 + 20, 'rank prizes + kills');
    const [w1, w2] = fake.rowsOf('user');
    assert.equal(w1.winningBalance, 250, '₹200 rank + ₹50 kills');
    assert.equal(w2.winningBalance, 140);
    assert.equal(w1.depositBalance, 0);

    const ledger = fake.rowsOf('walletLedger');
    assert.equal(ledger.length, 2);
    assert.ok(ledger.every((r) => r.category === 'WINNING_PRIZE' && r.type === 'CREDIT' && r.balanceType === 'WINNING'));
  });

  it('gives a disqualified player zero money', async () => {
    const out = await api.distributeTournamentPrizes(admin as any, tournamentId, [
      { userId: 'player-1', verifiedKills: 9, rank: 1, isDisqualified: true, disqualifyReason: 'teamers' },
      { userId: 'player-2', verifiedKills: 0, rank: 2 },
    ]);

    assert.equal(out.breakdown.some((b) => b.userId === 'player-1'), false, 'DQ players are not paid');
    assert.deepEqual(out.breakdown.map((b) => b.userId), ['player-2']);
    assert.equal(fake.rowsOf('user')[0].winningBalance, 0);
    const dqRecord = fake.rowsOf('matchResult').find((r) => r.userId === 'player-1');
    assert.equal(dqRecord?.isDisqualified, true);
    assert.equal(dqRecord?.disqualifyReason, 'teamers');
    assert.equal(Number(dqRecord?.prizeWon), 0);
  });

  it('never pays an already approved result twice', async () => {
    await api.distributeTournamentPrizes(admin as any, tournamentId, [
      { userId: 'player-1', verifiedKills: 3, rank: 1 },
    ]);
    assert.equal(fake.rowsOf('user')[0].winningBalance, 230);

    // The first payout completes the match, so a retry is refused outright.
    await assert.rejects(
      () =>
        api.distributeTournamentPrizes(admin as any, tournamentId, [
          { userId: 'player-1', verifiedKills: 3, rank: 1 },
        ]),
      /not allowed while tournament is COMPLETED/i,
    );
    assert.equal(fake.rowsOf('user')[0].winningBalance, 230, 'no double payout');
    assert.equal(fake.rowsOf('walletLedger').length, 1);
  });

  it('refuses strangers, empty result sets and non-payable statuses', async () => {
    await assert.rejects(
      () => api.distributeTournamentPrizes(admin as any, tournamentId, [
        { userId: 'unknown-player', verifiedKills: 1, rank: 1 },
      ]),
      /not a participant/i,
    );
    await assert.rejects(
      () => api.distributeTournamentPrizes(admin as any, tournamentId, []),
      /At least one verified result/i,
    );

    seed({ status: 'COMPLETED' });
    await assert.rejects(
      () => api.distributeTournamentPrizes(admin as any, tournamentId, [
        { userId: 'player-1', verifiedKills: 1, rank: 1 },
      ]),
      /not allowed while tournament is COMPLETED/i,
    );
  });

  it('builds the public scoreboard ordered by rank', async () => {
    await api.distributeTournamentPrizes(admin as any, tournamentId, [
      { userId: 'player-2', verifiedKills: 4, rank: 2 },
      { userId: 'player-1', verifiedKills: 7, rank: 1 },
    ]);

    const board = await api.getTournamentResults(tenantId, tournamentId);
    assert.equal(board.scoreboard.length, 2);
    assert.deepEqual(board.scoreboard.map((r) => r.rank), [1, 2]);
    assert.equal(board.scoreboard[0].player.inGameName, 'FF|Ravi');
    assert.equal(board.scoreboard[0].kills, 7);
    assert.equal(board.scoreboard[0].prizeWon, 270);

    await assert.rejects(() => api.getTournamentResults(tenantId, 'nope'), /Tournament not found/i);
  });
});
