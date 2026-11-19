/**
 * The lifecycle sweep is the only thing that moves matches forward without an
 * admin pressing a button: kickoff -> live -> under review. It must flip exactly
 * the due matches, start matches whose room was never published, and never leak
 * room credentials on its own.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type SweepApi = typeof import('../src/services/matchSweep.service.js');
let api: SweepApi;

const broadcasts: Array<{ event: string; payload: any }> = [];
const pushes: Array<{ type: string; tournamentId: string }> = [];
const directMessages: Array<{ userIds: string[]; event: string }> = [];

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  mock.module('../src/services/fcm.service.js', {
    namedExports: {
      pushToUser: async () => {},
      pushToUsers: async () => {},
      pushToTournamentParticipants: async (_id: string, payload: any) => {
        pushes.push({ type: payload.type, tournamentId: payload.tournamentId });
      },
    },
  });
  mock.module('../src/services/realtime.service.js', {
    namedExports: {
      realtimeService: {
        broadcast: (event: string, payload: any) => broadcasts.push({ event, payload }),
        broadcastToTenant: () => {},
        sendToUser: () => {},
        sendToUsers: (userIds: string[], event: string) => directMessages.push({ userIds, event }),
      },
    },
  });
  api = await import('../src/services/matchSweep.service.js');
});

const NOW = new Date('2026-03-01T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function seed(matches: Array<Record<string, unknown>>) {
  fake = new FakePrisma({
    tenants: [{ id: 'tenant-1', isActive: true }],
    tournaments: matches.map((m, i) => ({
      id: `tour-${i + 1}`,
      tenantId: 'tenant-1',
      title: `Match ${i + 1}`,
      status: 'OPEN',
      matchTime: minutes(10),
      roomRevealMinutes: 15,
      roomRevealedAt: null,
      roomId: null,
      roomPassword: null,
      entryFee: 25,
      totalSlots: 48,
      ...m,
    })),
    tournamentSlots: [],
  });
  return fake;
}

describe('sweepMatchStates', () => {
  beforeEach(() => {
    broadcasts.length = 0;
    pushes.length = 0;
    directMessages.length = 0;
  });

  it('never publishes a room on its own, however close kickoff is', async () => {
    seed([
      { matchTime: minutes(10), roomId: '88221144', roomPassword: 'ff2026' },
      { matchTime: minutes(0.5) },
    ]);
    (fake as any).store.tournamentSlot.push(
      { id: 'slot-1', tournamentId: 'tour-1', userId: 'player-1', slotNumber: 1 },
    );

    const out = await api.sweepMatchStates(NOW, 'tenant-1');

    assert.deepEqual(out.awaitingStart, [], 'nothing starts yet');
    assert.equal(fake.rowsOf('tournament')[0].status, 'OPEN');
    assert.equal(fake.rowsOf('tournament')[0].roomRevealedAt, null, 'room stays private');
    assert.equal(directMessages.length, 0, 'no credentials handed out');
    assert.equal(pushes.length, 0, 'no "room reveal" alert');
  });

  it('waits for the organiser when kickoff arrives and no room was published', async () => {
    seed([{ status: 'OPEN', matchTime: minutes(-1) }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.awaitingStart.map((m) => m.id), ['tour-1']);
    // The clock can never make a match LIVE — only the admin's "Go live" does.
    assert.deepEqual(out.wentLive, []);
    assert.equal(fake.rowsOf('tournament')[0].status, 'STARTING_SOON');
  });

  it('does not go LIVE at kickoff even when the room was already published', async () => {
    seed([{ status: 'ROOM_REVEALED', matchTime: minutes(-5), roomRevealedAt: minutes(-20) }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.awaitingStart.map((m) => m.id), ['tour-1']);
    assert.equal(fake.rowsOf('tournament')[0].status, 'STARTING_SOON');
  });

  it('leaves a match that starts in a few minutes alone', async () => {
    seed([{ status: 'OPEN', matchTime: minutes(3) }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.awaitingStart, []);
    assert.equal(fake.rowsOf('tournament')[0].status, 'OPEN');
  });

  it('moves long-finished live matches to UNDER_REVIEW after 2 hours', async () => {
    seed([
      { status: 'LIVE', matchTime: minutes(-181) },
      { status: 'LIVE', matchTime: minutes(-30) },
    ]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.movedToReview.map((m) => m.id), ['tour-1']);
    assert.equal(fake.rowsOf('tournament')[0].status, 'UNDER_REVIEW');
    assert.equal(fake.rowsOf('tournament')[1].status, 'LIVE');
  });

  it('does nothing for matches of another tenant', async () => {
    seed([{ status: 'OPEN', matchTime: minutes(-5), tenantId: 'tenant-2' }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.awaitingStart, []);
    assert.equal(fake.rowsOf('tournament')[0].status, 'OPEN');
  });
});

describe('forceMatchLive', () => {
  beforeEach(() => {
    broadcasts.length = 0;
    pushes.length = 0;
    directMessages.length = 0;
  });

  it('is the only way a waiting match becomes LIVE', async () => {
    seed([{ status: 'STARTING_SOON', matchTime: minutes(-5) }]);
    const out = await api.forceMatchLive('tour-1', 'tenant-1', NOW);
    assert.equal(out.changed, true);
    assert.equal(out.status, 'LIVE');
    assert.equal(fake.rowsOf('tournament')[0].status, 'LIVE');
    assert.deepEqual(
      broadcasts.map((b) => b.payload.status),
      ['LIVE'],
      'players are told the match really started',
    );
  });

  it('never resurrects a finished match', async () => {
    seed([{ status: 'COMPLETED', matchTime: minutes(-180) }]);
    await assert.rejects(() => api.forceMatchLive('tour-1', 'tenant-1', NOW), /cannot be started/i);
    assert.equal(fake.rowsOf('tournament')[0].status, 'COMPLETED');
  });
});
