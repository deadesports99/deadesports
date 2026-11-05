/**
 * The lifecycle sweep is the only thing that moves matches forward without an
 * admin pressing a button: room reveal -> live -> under review. It must flip
 * exactly the due matches and never leak room credentials early.
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

  it('reveals the room only once the admin window has opened', async () => {
    seed([
      { matchTime: minutes(10) }, // reveal window (15 min) already open
      { matchTime: minutes(60) }, // still 45 min away from reveal
    ]);

    const out = await api.sweepMatchStates(NOW, 'tenant-1');

    assert.deepEqual(out.roomRevealed.map((m) => m.id), ['tour-1']);
    assert.equal(fake.rowsOf('tournament')[0].status, 'ROOM_REVEALED');
    assert.ok(fake.rowsOf('tournament')[0].roomRevealedAt instanceof Date);
    assert.equal(fake.rowsOf('tournament')[1].status, 'OPEN', 'too early, untouched');
    assert.equal(out.revealWindowMinutes, 15);
    assert.equal(out.ranAt, NOW.toISOString());
    assert.equal(pushes.filter((p) => p.type === 'ROOM_REVEALED').length, 1);
    assert.ok(broadcasts.some((b) => b.payload?.status === 'ROOM_REVEALED'));
  });

  it('honours a custom per-match reveal window', async () => {
    seed([
      { matchTime: minutes(120), roomRevealMinutes: 180 }, // 3h window -> unlocked
      { matchTime: minutes(120), roomRevealMinutes: 60 }, // 1h window -> still locked
    ]);

    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.roomRevealed.map((m) => m.id), ['tour-1']);
  });

  it('starts revealed matches at kickoff', async () => {
    seed([{ status: 'ROOM_REVEALED', matchTime: minutes(-5) }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.wentLive.map((m) => m.id), ['tour-1']);
    assert.equal(fake.rowsOf('tournament')[0].status, 'LIVE');
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

  it('delivers saved room credentials to every participant on reveal', async () => {
    seed([{ matchTime: minutes(10), roomId: '88221144', roomPassword: 'ff2026' }]);
    fake.rowsOf; // keep the fake alive across the sweep
    (fake as any).store.tournamentSlot.push(
      { id: 'slot-1', tournamentId: 'tour-1', userId: 'player-1', slotNumber: 1 },
      { id: 'slot-2', tournamentId: 'tour-1', userId: 'player-2', slotNumber: 2 },
    );

    await api.sweepMatchStates(NOW, 'tenant-1');

    const message = directMessages.find((m) => m.event === 'ROOM_CREDENTIALS_REVEALED');
    assert.ok(message, 'credentials must be pushed to the room');
    assert.deepEqual(message!.userIds.sort(), ['player-1', 'player-2']);
  });

  it('does nothing for matches of another tenant', async () => {
    seed([{ matchTime: minutes(5), tenantId: 'tenant-2' }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.roomRevealed, []);
    assert.equal(fake.rowsOf('tournament')[0].status, 'OPEN');
  });

  it('never double-reveals an already revealed match', async () => {
    seed([{ matchTime: minutes(5), status: 'ROOM_REVEALED' }]);
    const out = await api.sweepMatchStates(NOW, 'tenant-1');
    assert.deepEqual(out.roomRevealed, []);
    assert.equal(pushes.length, 0);
  });
});
