/**
 * "My Matches" — the player's own history read path.
 *
 * The lobby feed hides finished matches, so these tests lock down the rules
 * that make the new section trustworthy:
 *   - only my own seats, only inside my tenant
 *   - upcoming above past, past newest-first, stable pagination
 *   - a result is never invented (no MatchResult row → `result: null`)
 *   - refunds come from the ledger, not from the match status
 *   - room credentials follow the same publish gate as the feed
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type MatchesApi = typeof import('../src/services/playerMatches.service.js');
let api: MatchesApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/playerMatches.service.js');
});

const tenantId = 'tenant-1';
const otherTenantId = 'tenant-2';
const userId = 'p1';
const otherUserId = 'p2';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const baseTournament = {
  tenantId,
  gameMode: 'BATTLE_ROYALE',
  matchType: 'SOLO',
  mapType: 'BERMUDA',
  entryFee: '20.00',
  perKillPrize: '10.00',
  totalSlots: 48,
  roomId: null as string | null,
  roomPassword: null as string | null,
  roomRevealedAt: null as Date | null,
  roomRevealMinutes: 15,
};

function seed() {
  fake = new FakePrisma({
    users: [
      { id: userId, tenantId, name: 'Jay', role: 'USER', isBanned: false },
      { id: otherUserId, tenantId, name: 'Aman', role: 'USER', isBanned: false },
    ],
    tournaments: [
      // Live right now.
      { ...baseTournament, id: 'tour-live', title: 'Bermuda Solo #1', matchNumber: 1, status: 'LIVE', matchTime: new Date(now - 10 * 60 * 1000) },
      // Next week — must sit above yesterday's results.
      { ...baseTournament, id: 'tour-future', title: 'Purgatory Solo #2', matchNumber: 2, status: 'OPEN', matchTime: new Date(now + 7 * DAY) },
      // Published room, finished top-1.
      {
        ...baseTournament,
        id: 'tour-booyah',
        title: 'Kalahari Solo #3',
        matchNumber: 3,
        status: 'COMPLETED',
        matchTime: new Date(now - DAY),
        roomId: '44556677',
        roomPassword: 'pass9',
        roomRevealedAt: new Date(now - DAY),
      },
      // Cancelled + refunded.
      { ...baseTournament, id: 'tour-cancelled', title: 'Alpine Solo #4', matchNumber: 4, status: 'CANCELLED', matchTime: new Date(now - 2 * DAY) },
      // Completed but the scorer never published a result.
      { ...baseTournament, id: 'tour-noresult', title: 'Bermuda Solo #5', matchNumber: 5, status: 'COMPLETED', matchTime: new Date(now - 3 * DAY) },
      // Another tenant — must never leak in.
      { ...baseTournament, tenantId: otherTenantId, id: 'tour-foreign', title: 'Bermuda Solo #9', matchNumber: 9, status: 'COMPLETED', matchTime: new Date(now - DAY) },
    ],
    tournamentSlots: [
      { id: 's-live', tournamentId: 'tour-live', userId, slotNumber: 4, joinedAt: new Date(now - 2 * DAY), inGameNameSnapshot: 'FF|Jay', inGameUidSnapshot: '123456789', isBanned: false },
      { id: 's-future', tournamentId: 'tour-future', userId, slotNumber: 12, joinedAt: new Date(now - DAY), inGameNameSnapshot: 'FF|Jay', inGameUidSnapshot: '123456789', isBanned: false },
      { id: 's-booyah', tournamentId: 'tour-booyah', userId, slotNumber: 7, joinedAt: new Date(now - 3 * DAY), inGameNameSnapshot: 'FF|Jay', inGameUidSnapshot: '123456789', isBanned: false },
      { id: 's-cancelled', tournamentId: 'tour-cancelled', userId, slotNumber: 21, joinedAt: new Date(now - 4 * DAY), inGameNameSnapshot: 'FF|Jay', inGameUidSnapshot: '123456789', isBanned: false },
      { id: 's-noresult', tournamentId: 'tour-noresult', userId, slotNumber: 9, joinedAt: new Date(now - 5 * DAY), inGameNameSnapshot: 'FF|Jay', inGameUidSnapshot: '123456789', isBanned: true, banReason: 'Teaming' },
      // Someone else's seat in my match — never shown as "my" match data.
      { id: 's-other', tournamentId: 'tour-booyah', userId: otherUserId, slotNumber: 8, joinedAt: new Date(now - 3 * DAY) },
      { id: 's-foreign', tournamentId: 'tour-foreign', userId, slotNumber: 3, joinedAt: new Date(now - 2 * DAY) },
    ],
    matchResults: [
      { id: 'r-1', tournamentId: 'tour-booyah', userId, verifiedKills: 6, rank: 1, prizeWon: 70, isApproved: true, isDisqualified: false, disqualifyReason: null },
      { id: 'r-2', tournamentId: 'tour-live', userId, verifiedKills: 2, rank: null, prizeWon: 0, isApproved: false, isDisqualified: false, disqualifyReason: null },
      { id: 'r-3', tournamentId: 'tour-foreign', userId, verifiedKills: 9, rank: 1, prizeWon: 99, isApproved: true, isDisqualified: false, disqualifyReason: null },
    ],
    walletLedger: [
      { id: 'l-1', tenantId, userId, amount: '20.00', balanceType: 'DEPOSIT', type: 'CREDIT', category: 'REFUND', balanceAfter: 120, referenceId: 'tour-cancelled', notes: 'Refund', createdAt: new Date(now - DAY) },
      { id: 'l-2', tenantId, userId, amount: '20.00', balanceType: 'DEPOSIT', type: 'DEBIT', category: 'JOIN_FEE', balanceAfter: 100, referenceId: 'tour-booyah', notes: 'Entry', createdAt: new Date(now - 3 * DAY) },
    ],
  });
  return fake;
}

describe('my matches — buckets', () => {
  beforeEach(() => seed());

  it('returns only my own seats inside my tenant', async () => {
    const page = await api.getMyMatches(userId, tenantId);

    const ids = page.items.map((item) => item.id);
    assert.deepEqual(
      [...ids].sort(),
      ['tour-live', 'tour-future', 'tour-booyah', 'tour-cancelled', 'tour-noresult'].sort(),
    );
    assert.ok(!ids.includes('tour-foreign'), 'another tenant must never leak in');
    assert.equal(page.pagination.total, 5);
  });

  it('puts live/upcoming first (soonest first) and finished matches newest-first', async () => {
    const page = await api.getMyMatches(userId, tenantId);

    assert.deepEqual(
      page.items.map((item) => item.id),
      ['tour-live', 'tour-future', 'tour-booyah', 'tour-cancelled', 'tour-noresult'],
    );
    assert.equal(page.items[0].phase, 'live');
    assert.equal(page.items[1].phase, 'upcoming');
  });

  it('pages across the two segments without dropping or repeating a row', async () => {
    const first = await api.getMyMatches(userId, tenantId, { page: 1, limit: 2 });
    const second = await api.getMyMatches(userId, tenantId, { page: 2, limit: 2 });
    const third = await api.getMyMatches(userId, tenantId, { page: 3, limit: 2 });

    assert.deepEqual(first.items.map((i) => i.id), ['tour-live', 'tour-future']);
    assert.deepEqual(second.items.map((i) => i.id), ['tour-booyah', 'tour-cancelled']);
    assert.deepEqual(third.items.map((i) => i.id), ['tour-noresult']);
    assert.equal(first.pagination.totalPages, 3);
  });

  it('filters by bucket using the shared status map', async () => {
    const upcoming = await api.getMyMatches(userId, tenantId, { bucket: 'upcoming' });
    const live = await api.getMyMatches(userId, tenantId, { bucket: 'live' });
    const completed = await api.getMyMatches(userId, tenantId, { bucket: 'completed' });
    const cancelled = await api.getMyMatches(userId, tenantId, { bucket: 'cancelled' });

    assert.deepEqual(upcoming.items.map((i) => i.id), ['tour-future']);
    assert.deepEqual(live.items.map((i) => i.id), ['tour-live']);
    assert.deepEqual(completed.items.map((i) => i.id).sort(), ['tour-booyah', 'tour-noresult']);
    assert.deepEqual(cancelled.items.map((i) => i.id), ['tour-cancelled']);
  });

  it('rejects an unknown bucket instead of guessing', async () => {
    await assert.rejects(
      () => api.getMyMatches(userId, tenantId, { bucket: 'nonsense' as any }),
      /bucket must be one of/,
    );
  });
});

describe('my matches — result, refund and room state', () => {
  beforeEach(() => seed());

  it('carries the verified result on the card', async () => {
    const page = await api.getMyMatches(userId, tenantId, { bucket: 'completed' });
    const booyah = page.items.find((item) => item.id === 'tour-booyah');

    assert.ok(booyah);
    assert.equal(booyah.result?.rank, 1);
    assert.equal(booyah.result?.kills, 6);
    assert.equal(booyah.result?.prizeWon, 70);
    assert.equal(booyah.result?.isApproved, true);
    assert.equal(booyah.net, 50, 'prize − entry fee');
    assert.equal(booyah.slotNumber, 7);
    assert.equal(booyah.inGameNameSnapshot, 'FF|Jay');
  });

  it('never invents a result the scorer has not published', async () => {
    const page = await api.getMyMatches(userId, tenantId, { bucket: 'completed' });
    const pending = page.items.find((item) => item.id === 'tour-noresult');

    assert.ok(pending);
    assert.equal(pending.result, null);
    assert.equal(pending.net, null);
    assert.equal(pending.isBannedFromMatch, true);
    assert.equal(pending.banReason, 'Teaming');
  });

  it('reports a cancelled match as refunded from the ledger', async () => {
    const page = await api.getMyMatches(userId, tenantId, { bucket: 'cancelled' });
    const cancelled = page.items[0];

    assert.equal(cancelled.id, 'tour-cancelled');
    assert.equal(cancelled.refunded, true);
    assert.equal(cancelled.refundAmount, 20);
    assert.equal(cancelled.net, 0);
  });

  it('hands over the room code only after staff published it', async () => {
    const page = await api.getMyMatches(userId, tenantId);

    const published = page.items.find((item) => item.id === 'tour-booyah');
    const unpublished = page.items.find((item) => item.id === 'tour-future');

    assert.deepEqual(published?.room, { roomId: '44556677', roomPassword: 'pass9' });
    assert.equal(published?.roomUnlocked, true);
    assert.equal(unpublished?.room, null);
    assert.equal(unpublished?.roomUnlocked, false);
  });
});

describe('my matches — summary strip', () => {
  beforeEach(() => seed());

  it('counts played matches, booyahs, kills, winnings and each phase', async () => {
    const page = await api.getMyMatches(userId, tenantId);
    const { summary } = page;

    assert.equal(summary.matchesJoined, 5, '5 seats in this tenant (foreign tenant is not counted here)');
    assert.equal(summary.matchesPlayed, 2, 'only rows with a MatchResult');
    assert.equal(summary.booyahs, 1);
    assert.equal(summary.totalKills, 8);
    assert.equal(summary.totalWinnings, 70);
    assert.equal(summary.bestRank, 1);
    assert.equal(summary.upcomingCount, 1);
    assert.equal(summary.liveCount, 1);
    assert.equal(summary.completedCount, 2);
    assert.equal(summary.cancelledCount, 1);
  });
});
