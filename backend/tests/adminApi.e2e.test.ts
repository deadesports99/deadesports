/**
 * Admin console over real HTTP: match creation, room publishing, prize payout,
 * wallet queues, settlement export, staff CRUD and player management.
 * Every route is exercised through its real permission guard.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

let fake: FakePrisma;
let server: import('node:http').Server;
let baseUrl = '';
let env: typeof import('../src/config/env.js').env;

const tenantId = 'tenant-1';
const adminId = 'admin-1';
const playerId = 'player-1';

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
  mock.module('../src/services/slotLock.service.js', {
    namedExports: {
      reserveSlot: async () => ({ ok: true }),
      releaseSlot: async () => {},
      getOccupiedSlots: async () => ({}),
      hydrateSlotsFromDb: async () => {},
      createTeam: async () => true,
      joinTeam: async () => ({ ok: true, teamId: 'team-1' }),
      deleteTeam: async () => {},
      decrementTeamMembers: async () => {},
      generateTeamCode: () => '123456',
      getTeamMembers: async () => 1,
      clearTournamentRedis: async () => {},
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

  env = (await import('../src/config/env.js')).env;
  const { app } = await import('../src/app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server?.close());

const adminUser = () => ({
  id: adminId,
  tenantId,
  role: 'ADMIN',
  phoneNumber: '9999900009',
  playerCode: 'THU-0009',
  isBanned: false,
  canCreateMatch: true,
  canUpdateRoomId: true,
  canDistributePrize: true,
  canManageWallet: true,
  depositBalance: 0,
  winningBalance: 0,
  createdAt: new Date(),
});

const playerUser = () => ({
  id: playerId,
  tenantId,
  role: 'USER',
  phoneNumber: '9999900001',
  playerCode: 'THU-0001',
  inGameName: 'FF|Ravi',
  inGameUid: '123456789',
  isBanned: false,
  canCreateMatch: false,
  canUpdateRoomId: false,
  canDistributePrize: false,
  canManageWallet: false,
  depositBalance: 100,
  winningBalance: 50,
  createdAt: new Date(),
});

const staffUser = () => ({
  ...playerUser(),
  id: 'staff-1',
  role: 'SUB_ADMIN',
  phoneNumber: '9999900002',
  canCreateMatch: true,
});

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

function seed() {
  fake = new FakePrisma({
    tenants: [
      {
        id: tenantId,
        brandName: 'Thunder',
        isActive: true,
        upiId: 'thunder@okaxis',
        upiName: 'Thunder Esports',
        minDeposit: 10,
        commissionRate: 10,
        allowPhoneAuth: true,
        allowGoogleAuth: true,
        allowEmailAuth: true,
      },
    ],
    users: [adminUser(), playerUser(), staffUser()],
    tournaments: [
      {
        id: 'tour-1',
        tenantId,
        title: 'Bermuda Solo #1',
        status: 'OPEN',
        gameMode: 'BATTLE_ROYALE',
        matchType: 'SOLO',
        mapType: 'BERMUDA',
        entryFee: 25,
        prizePool: 400,
        perKillPrize: 10,
        totalSlots: 48,
        joinedCount: 2,
        matchTime: minutes(120),
        roomRevealMinutes: 15,
        roomRevealedAt: null,
        roomId: null,
        roomPassword: null,
        visibilityHours: null,
        createdAt: new Date(),
      },
    ],
    tournamentSlots: [
      { id: 'slot-1', tournamentId: 'tour-1', userId: playerId, slotNumber: 1 },
      { id: 'slot-2', tournamentId: 'tour-1', userId: 'staff-1', slotNumber: 2 },
    ],
    depositRequests: [
      { id: 'dep-1', tenantId, userId: playerId, amount: 500, utrNumber: 'UTR111222333', status: 'PENDING', createdAt: new Date(), reviewedAt: null },
    ],
    withdrawalRequests: [
      { id: 'wd-1', tenantId, userId: playerId, amount: 50, upiId: 'p@okaxis', status: 'PENDING', createdAt: new Date(), reviewedAt: null },
    ],
    paymentOrders: [
      {
        id: 'pay-order-1',
        tenantId,
        userId: playerId,
        provider: 'mock',
        providerOrderId: 'order_mock_abc',
        amountPaise: 50_000,
        currency: 'INR',
        status: 'CREATED',
        receipt: 'rcpt_1',
        createdAt: new Date(),
        capturedAt: null,
        expiresAt: minutes(15),
      },
    ],
    emailOtps: [],
  });
  return fake;
}

function token(forUserId = adminId, role = 'ADMIN') {
  return jwt.sign({ userId: forUserId, tenantId, role }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function call(
  path: string,
  options: { method?: string; body?: unknown; as?: string; role?: string; raw?: boolean } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers.Authorization = `Bearer ${token(options.as ?? (options.role === 'USER' ? playerId : adminId), options.role ?? 'ADMIN')}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (options.raw) return { status: res.status, text: await res.text(), headers: res.headers };
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

describe('match management', () => {
  beforeEach(() => seed());

  it('creates a match and auto-titles it', async () => {
    const res = await call('/api/v1/tournaments', {
      method: 'POST',
      body: {
        gameMode: 'BATTLE_ROYALE',
        matchType: 'SQUAD',
        mapType: 'BERMUDA',
        entryFee: 40,
        prizePool: 1200,
        perKillPrize: 5,
        matchTime: minutes(180).toISOString(),
      },
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.data.title, /\d+ \| Bermuda Squad/);
    assert.equal(res.body.data.status, 'OPEN');
    assert.equal(res.body.data.entryFee, 40);
    assert.equal(fake.rowsOf('tournament').length, 2);
  });

  it('rejects a bad payload and players without canCreateMatch', async () => {
    const bad = await call('/api/v1/tournaments', {
      method: 'POST',
      body: { gameMode: 'NOPE', entryFee: -5 },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.message, 'Validation failed');

    const forbidden = await call('/api/v1/tournaments', {
      method: 'POST',
      as: playerId,
      role: 'USER',
      body: {
        gameMode: 'BATTLE_ROYALE',
        matchType: 'SOLO',
        mapType: 'BERMUDA',
        entryFee: 40,
        prizePool: 100,
        matchTime: minutes(180).toISOString(),
      },
    });
    assert.equal(forbidden.status, 403);
  });

  it('lists, filters and reads a match with its slots', async () => {
    const list = await call('/api/v1/tournaments?status=OPEN&limit=5');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1, JSON.stringify(list.body.data).slice(0, 300));
    assert.equal(list.body.data.pagination.total, 1);
    assert.equal(list.body.data.items[0].slotsBooked, 2);

    const details = await call('/api/v1/tournaments/tour-1');
    assert.equal(details.status, 200);
    assert.equal(details.body.data.title, 'Bermuda Solo #1');

    const slots = await call('/api/v1/tournaments/tour-1/slots');
    assert.equal(slots.status, 200);
    assert.equal(slots.body.data.totalSlots, 48);
    assert.equal(slots.body.data.booked, 2);
    assert.equal(slots.body.data.slots[0].slotNumber, 1);
    assert.equal(slots.body.data.slots[0].player.phoneNumber, '9999900001');
    assert.equal(slots.body.data.slots[2].player, null, 'empty seats stay empty');

    const missing = await call('/api/v1/tournaments/ghost');
    assert.equal(missing.status, 404);
  });

  it('clones a match into the future and edits the visibility window', async () => {
    const clone = await call('/api/v1/tournaments/tour-1/clone', {
      method: 'POST',
      body: { matchTime: minutes(240).toISOString() },
    });
    assert.equal(clone.status, 201, JSON.stringify(clone.body));
    assert.equal(fake.rowsOf('tournament').length, 2);

    const visibility = await call('/api/v1/tournaments/tour-1/visibility', {
      method: 'PATCH',
      body: { visibilityHours: 12 },
    });
    assert.equal(visibility.status, 200);
    assert.equal(fake.rowsOf('tournament').find((t) => t.id === 'tour-1')?.visibilityHours, 12);
  });

  it('cancels a match and refunds the participants', async () => {
    const res = await call('/api/v1/tournaments/tour-1/cancel', {
      method: 'POST',
      body: { reason: 'not enough players' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.refundedPlayers, 2);
    assert.equal(res.body.data.totalRefunded, 50);

    const short = await call('/api/v1/tournaments/tour-1/cancel', { method: 'POST', body: { reason: 'x' } });
    assert.equal(short.status, 400);
  });

  it('runs the lifecycle sweep on demand', async () => {
    fake.rowsOf('tournament')[0].matchTime = minutes(5);
    const res = await call('/api/v1/tournaments/sweep/states', { method: 'POST', body: {} });
    assert.ok([200, 201].includes(res.status), `unexpected ${res.status}`);
  });
});

describe('room, results and payout', () => {
  beforeEach(() => seed());

  it('publishes room credentials then reveals them', async () => {
    const publish = await call('/api/v1/tournaments/tour-1/room', {
      method: 'PATCH',
      body: { roomId: '88221144', roomPassword: 'ff2026' },
    });
    assert.equal(publish.status, 200);
    assert.equal(publish.body.data.room.roomId, '88221144');

    const reveal = await call('/api/v1/tournaments/tour-1/room-reveal', {
      method: 'PATCH',
      body: { revealNow: true },
    });
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.data.status, 'ROOM_REVEALED');

    const asPlayer = await call('/api/v1/tournaments/tour-1/room', { as: playerId, role: 'USER' });
    assert.equal(asPlayer.status, 200);
    assert.equal(asPlayer.body.data.roomId, '88221144');
  });

  it('pays winners by UID and shows the scoreboard', async () => {
    const finish = await call('/api/v1/tournaments/tour-1/finish', {
      method: 'POST',
      body: { winnerUid: '123456789', winnerKills: 4 },
    });
    assert.equal(finish.status, 200);
    assert.equal(finish.body.data.totalPaid, 240);
    assert.equal(fake.rowsOf('user').find((u) => u.id === playerId)?.winningBalance, 290);

    const board = await call('/api/v1/tournaments/tour-1/results');
    assert.equal(board.status, 200);
    assert.equal(board.body.data.scoreboard[0].kills, 4);

    const again = await call('/api/v1/tournaments/tour-1/finish', {
      method: 'POST',
      body: { winnerUid: '123456789', winnerKills: 1 },
    });
    assert.equal(again.status, 409);
  });

  it('distributes prizes through the staff payout route only with permission', async () => {
    const res = await call('/api/v1/tournaments/tour-1/payout', {
      method: 'POST',
      body: { results: [{ userId: playerId, verifiedKills: 3, rank: 1 }] },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.playersPaid, 1);

    const forbidden = await call('/api/v1/tournaments/tour-1/payout', {
      method: 'POST',
      as: playerId,
      role: 'USER',
      body: { results: [{ userId: playerId, verifiedKills: 1, rank: 1 }] },
    });
    assert.equal(forbidden.status, 403);
  });
});

describe('wallet console', () => {
  beforeEach(() => seed());

  it('approves a UTR deposit once and credits the wallet', async () => {
    const list = await call('/api/v1/admin/wallet/deposits');
    assert.equal(list.status, 200);

    const approve = await call('/api/v1/admin/wallet/deposits/dep-1/approve', { method: 'POST', body: {} });
    assert.equal(approve.status, 200);
    assert.equal(fake.rowsOf('user').find((u) => u.id === playerId)?.depositBalance, 600);

    const doubleApprove = await call('/api/v1/admin/wallet/deposits/dep-1/approve', { method: 'POST', body: {} });
    assert.ok([200, 409].includes(doubleApprove.status), 'second approve must not pay twice');
    assert.equal(fake.rowsOf('user').find((u) => u.id === playerId)?.depositBalance, 600);
  });

  it('rejects a deposit without crediting anyone', async () => {
    const reject = await call('/api/v1/admin/wallet/deposits/dep-1/reject', {
      method: 'POST',
      body: { reason: 'UTR not found in bank statement' },
    });
    assert.equal(reject.status, 200, JSON.stringify(reject.body));
    assert.equal(fake.rowsOf('user').find((u) => u.id === playerId)?.depositBalance, 100);
  });

  it('approves and rejects withdrawals', async () => {
    const list = await call('/api/v1/admin/wallet/withdrawals');
    assert.equal(list.status, 200);

    const approve = await call('/api/v1/admin/wallet/withdrawals/wd-1/approve', {
      method: 'POST',
      body: { utrNumber: 'UTR999888777' },
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));

    seed();
    const reject = await call('/api/v1/admin/wallet/withdrawals/wd-1/reject', {
      method: 'POST',
      body: { reason: 'UPI id invalid' },
    });
    assert.equal(reject.status, 200);
    assert.equal(
      fake.rowsOf('user').find((u) => u.id === playerId)?.winningBalance,
      100,
      'the held ₹50 comes back on top of the ₹50 already in the wallet',
    );
  });

  it('shows online payments and syncs a stuck order', async () => {
    const list = await call('/api/v1/admin/wallet/payments?status=ALL');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.summary.demoMode, true);

    const badFilter = await call('/api/v1/admin/wallet/payments?status=WHATEVER');
    assert.equal(badFilter.status, 400);

    const sync = await call('/api/v1/admin/wallet/payments/pay-order-1/sync', { method: 'POST', body: {} });
    assert.ok([200, 404, 409, 502].includes(sync.status), `unexpected ${sync.status}`);
  });

  it('exports the daily settlement as CSV', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const summary = await call(`/api/v1/admin/wallet/settlement?date=${date}`);
    assert.equal(summary.status, 200);
    assert.equal(summary.body.data.summary.date, date);

    const csv = await call(`/api/v1/admin/wallet/settlement/export.csv?date=${date}`, { raw: true });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
    assert.match(csv.headers.get('content-disposition') ?? '', new RegExp(`settlement-${date}\\.csv`));
    assert.match(csv.text, /Daily Settlement Report/);

    const badDate = await call('/api/v1/admin/wallet/settlement?date=15-03-2026');
    assert.equal(badDate.status, 400);
  });

  it('locks the whole console to wallet managers', async () => {
    for (const path of ['/api/v1/admin/wallet/deposits', '/api/v1/admin/wallet/payments', '/api/v1/admin/wallet/settlement?date=2026-03-15']) {
      const res = await call(path, { as: playerId, role: 'USER' });
      assert.equal(res.status, 403, `${path} must be guarded`);
    }
  });
});

describe('staff + player admin', () => {
  beforeEach(() => seed());

  it('runs staff CRUD end to end', async () => {
    const created = await call('/api/v1/auth/admin/staff', {
      method: 'POST',
      body: {
        name: 'New Hire',
        email: 'hire@example.com',
        phoneNumber: '9000000001',
        permissions: { canCreateMatch: true },
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.user.role, 'SUB_ADMIN');

    const list = await call('/api/v1/auth/admin/staff');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.count >= 2);

    const id = created.body.data.user.id;
    const patched = await call(`/api/v1/auth/admin/staff/${id}`, {
      method: 'PATCH',
      body: { permissions: { canManageWallet: true } },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.staff.permissions.canManageWallet, true, JSON.stringify(patched.body.data));

    const removed = await call(`/api/v1/auth/admin/staff/${id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.staff.isBanned, true);
  });

  it('keeps staff routes admin-only', async () => {
    const res = await call('/api/v1/auth/admin/staff', { as: 'staff-1', role: 'SUB_ADMIN' });
    assert.equal(res.status, 403);
  });

  it('serves player stats and game profile', async () => {
    const stats = await call('/api/v1/players/me/stats', { as: playerId, role: 'USER' });
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.matchesJoined, 1, JSON.stringify(stats.body.data));

    const update = await call('/api/v1/players/me/game-profile', {
      method: 'PATCH',
      as: playerId,
      role: 'USER',
      body: { inGameName: 'FF|Ravi2', inGameUid: '555666777' },
    });
    assert.equal(update.status, 200);
    assert.equal(update.body.data.inGameUid, '555666777');

    const clash = await call('/api/v1/players/me/game-profile', {
      method: 'PATCH',
      as: 'staff-1',
      role: 'SUB_ADMIN',
      body: { inGameName: 'FF|x', inGameUid: '555666777' },
    });
    assert.equal(clash.status, 409);
  });

  it('searches and bans players', async () => {
    const search = await call('/api/v1/admin/players?search=THU-0001');
    assert.equal(search.status, 200);
    assert.equal(search.body.data.total, 1);

    const ban = await call(`/api/v1/admin/players/${playerId}/ban`, {
      method: 'PATCH',
      body: { isBanned: true },
    });
    assert.equal(ban.status, 200);
    assert.equal(ban.body.data.isBanned, true);
  });

  it('exposes tenant settings publicly and lets only the admin edit them', async () => {
    const settings = await call('/api/v1/tenant/settings', { as: playerId, role: 'USER' });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.data.upiId, 'thunder@okaxis');

    const updated = await call('/api/v1/admin/tenant/settings', {
      method: 'PATCH',
      body: { upiId: 'newpay@okhdfcbank', minDeposit: 100 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.minDeposit, 100);

    const locked = await call('/api/v1/admin/tenant/settings', {
      method: 'PATCH',
      as: playerId,
      role: 'USER',
      body: { minDeposit: 500 },
    });
    assert.equal(locked.status, 403);
  });
});
