/**
 * Player-facing profile stats, admin player search/ban, and the tenant settings
 * that drive the Add-Cash QR, minimum deposit and login switches.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type PlayerApi = typeof import('../src/services/player.service.js');
type AdminPlayerApi = typeof import('../src/services/playerAdmin.service.js');
type TenantApi = typeof import('../src/services/tenant.service.js');
let playerApi: PlayerApi;
let adminPlayerApi: AdminPlayerApi;
let tenantApi: TenantApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  playerApi = await import('../src/services/player.service.js');
  adminPlayerApi = await import('../src/services/playerAdmin.service.js');
  tenantApi = await import('../src/services/tenant.service.js');
});

const tenantId = 'tenant-1';

function seed() {
  fake = new FakePrisma({
    tenants: [
      {
        id: tenantId,
        brandName: 'Thunder Esports',
        isActive: true,
        upiId: 'thunder@okaxis',
        upiName: 'Thunder Esports',
        supportWhatsapp: '919999900001',
        minDeposit: 50,
        allowPhoneAuth: true,
        allowGoogleAuth: true,
        allowEmailAuth: true,
      },
    ],
    users: [
      { id: 'p1', tenantId, phoneNumber: '9999900001', name: 'Ravi', inGameName: 'FF|Ravi', inGameUid: '123456789', playerCode: 'THU-0001', role: 'USER', isBanned: false, depositBalance: 120.5, winningBalance: 40.25, createdAt: new Date('2026-02-01') },
      { id: 'p2', tenantId, phoneNumber: '9999900002', name: 'Aman Kumar', inGameName: 'FF|Aman', inGameUid: '987654321', playerCode: 'THU-0002', role: 'USER', isBanned: false, depositBalance: 0, winningBalance: 0, createdAt: new Date('2026-02-02') },
      { id: 'admin-1', tenantId, phoneNumber: '9999900009', playerCode: 'THU-0009', role: 'ADMIN', isBanned: false, createdAt: new Date('2026-01-01') },
    ],
    tournamentSlots: [
      { id: 's1', tournamentId: 'tour-1', userId: 'p1', slotNumber: 1 },
      { id: 's2', tournamentId: 'tour-2', userId: 'p1', slotNumber: 2 },
      { id: 's3', tournamentId: 'tour-3', userId: 'p2', slotNumber: 3 },
    ],
    matchResults: [
      { id: 'm1', tournamentId: 'tour-1', userId: 'p1', verifiedKills: 7, rank: 1, prizeWon: 240, isApproved: true, isDisqualified: false },
      { id: 'm2', tournamentId: 'tour-2', userId: 'p1', verifiedKills: 3, rank: 4, prizeWon: 10, isApproved: true, isDisqualified: false },
      { id: 'm3', tournamentId: 'tour-3', userId: 'p1', verifiedKills: 0, rank: 2, prizeWon: 0, isApproved: true, isDisqualified: false },
      { id: 'm4', tournamentId: 'tour-3', userId: 'p2', verifiedKills: 12, rank: 1, prizeWon: 0, isApproved: true, isDisqualified: true },
    ],
  });
  return fake;
}

describe('player stats', () => {
  beforeEach(() => seed());

  it('derives career numbers from real rows', async () => {
    const stats = await playerApi.getPlayerStats('p1', tenantId);

    assert.equal(stats.matchesJoined, 2);
    assert.equal(stats.matchesPlayed, 3);
    assert.equal(stats.booyahs, 1, 'only approved rank-1 finishes count');
    assert.equal(stats.totalKills, 10);
    assert.equal(stats.totalWinnings, 250);
    assert.equal(stats.bestRank, 1);
  });

  it('ignores disqualified results and keeps tenants apart', async () => {
    const stats = await playerApi.getPlayerStats('p2', tenantId);
    assert.equal(stats.booyahs, 0, 'a DQ win is not a booyah');
    assert.equal(stats.totalKills, 12);

    await assert.rejects(() => playerApi.getPlayerStats('p1', 'tenant-2'), /User not found/i);
  });

  it('updates the in-game profile and blocks a UID owned by someone else', async () => {
    const updated = await playerApi.updateGameProfile('p2', tenantId, {
      inGameName: '  FF|Aman2  ',
      inGameUid: ' 555666777 ',
    });
    assert.equal(updated.inGameName, 'FF|Aman2');
    assert.equal(updated.inGameUid, '555666777');

    await assert.rejects(
      () => playerApi.updateGameProfile('p2', tenantId, { inGameName: 'x', inGameUid: '123456789' }),
      /already registered/i,
    );
  });
});

describe('admin player management', () => {
  beforeEach(() => seed());

  it('lists only players, newest first, with balances as strings', async () => {
    const out = await adminPlayerApi.listAdminPlayers(tenantId);
    assert.equal(out.total, 2, 'staff and admins are excluded');
    assert.deepEqual(out.players.map((p) => p.id), ['p2', 'p1']);
    assert.equal(out.players[1].depositBalance, '120.5');
    assert.equal(out.players[1].winningBalance, '40.25');
    assert.equal(out.players[1].matchesJoined, 2);
  });

  it('searches by code, phone, name, in-game name and UID', async () => {
    for (const [term, expected] of [
      ['THU-0002', 'p2'],
      ['9999900001', 'p1'],
      ['aman', 'p2'],
      ['FF|Ravi', 'p1'],
      ['987654321', 'p2'],
    ] as const) {
      const out = await adminPlayerApi.listAdminPlayers(tenantId, term);
      assert.deepEqual(out.players.map((p) => p.id), [expected], `search "${term}"`);
    }

    const none = await adminPlayerApi.listAdminPlayers(tenantId, 'zzzz');
    assert.equal(none.total, 0);
  });

  it('clamps the page size', async () => {
    assert.equal((await adminPlayerApi.listAdminPlayers(tenantId, undefined, 1)).players.length, 1);
    assert.equal((await adminPlayerApi.listAdminPlayers(tenantId, undefined, 5000)).players.length, 2);
  });

  it('bans and unbans a player idempotently', async () => {
    const banned = await adminPlayerApi.setPlayerBanned(tenantId, 'p1', true);
    assert.equal(banned.isBanned, true);
    assert.equal(fake.rowsOf('user').find((u) => u.id === 'p1')?.isBanned, true);

    const again = await adminPlayerApi.setPlayerBanned(tenantId, 'p1', true);
    assert.equal(again.isBanned, true, 'second ban is a no-op');

    const unbanned = await adminPlayerApi.setPlayerBanned(tenantId, 'p1', false);
    assert.equal(unbanned.isBanned, false);
  });

  it('never touches staff, other tenants or unknown ids', async () => {
    await assert.rejects(
      () => adminPlayerApi.setPlayerBanned(tenantId, 'admin-1', true),
      /Player not found/i,
    );
    await assert.rejects(
      () => adminPlayerApi.setPlayerBanned('tenant-2', 'p1', true),
      /Player not found/i,
    );
  });
});

describe('tenant settings', () => {
  beforeEach(() => seed());

  it('returns the public payment + branding settings', async () => {
    const settings = await tenantApi.getTenantSettings(tenantId);
    assert.equal(settings.brandName, 'Thunder Esports');
    assert.equal(settings.upiId, 'thunder@okaxis');
    assert.equal(settings.minDeposit, 50);
    assert.equal(settings.supportWhatsapp, '919999900001');
    await assert.rejects(() => tenantApi.getTenantSettings('ghost'), /Tenant not found/i);
  });

  it('updates UPI, payee name, support number and minimum deposit', async () => {
    const out = await tenantApi.updateTenantSettings(tenantId, {
      upiId: ' newpay@okhdfcbank ',
      upiName: 'New Payee',
      supportWhatsapp: '+91 99999 00002',
      minDeposit: 100,
    });
    assert.equal(out.upiId, 'newpay@okhdfcbank');
    assert.equal(out.upiName, 'New Payee');
    assert.equal(out.supportWhatsapp, '919999900002', 'formatted number is stripped');
    assert.equal(out.minDeposit, 100);
  });

  it('clears the optional support number', async () => {
    const out = await tenantApi.updateTenantSettings(tenantId, { supportWhatsapp: '   ' });
    assert.equal(out.supportWhatsapp, '', 'blank input clears the number');
    assert.equal(fake.rowsOf('tenant')[0].supportWhatsapp, null, 'stored as NULL');
  });

  it('validates every field instead of trusting the admin app', async () => {
    for (const [patch, pattern] of [
      [{ upiId: '   ' }, /cannot be empty/i],
      [{ upiId: 'notaupi' }, /must look like name@bank/i],
      [{ upiName: 'x' }, /between 2 and 60/i],
      [{ supportWhatsapp: '123' }, /10-15 digits/i],
      [{ minDeposit: 5 }, /between ₹10 and ₹10000/i],
      [{ minDeposit: 50_000 }, /between ₹10 and ₹10000/i],
      [{}, /Nothing to update/i],
    ] as const) {
      await assert.rejects(() => tenantApi.updateTenantSettings(tenantId, patch as any), pattern);
    }
  });

  it('refuses to disable every login method', async () => {
    await assert.rejects(
      () =>
        tenantApi.updateTenantSettings(tenantId, {
          allowPhoneAuth: false,
          allowGoogleAuth: false,
          allowEmailAuth: false,
        }),
      /At least one authentication method/i,
    );

    const out = await tenantApi.updateTenantSettings(tenantId, { allowEmailAuth: false });
    assert.equal(out.allowEmailAuth, false);
    assert.equal(out.allowPhoneAuth, true);
  });

  it('blocks a deactivated tenant and resolves the deposit floor', async () => {
    seed();
    fake.rowsOf('tenant')[0].isActive = false;
    await assert.rejects(
      () => tenantApi.updateTenantSettings(tenantId, { minDeposit: 20 }),
      /deactivated/i,
    );

    seed();
    assert.equal(await tenantApi.resolveMinDeposit(tenantId), 50);
    assert.equal(await tenantApi.resolveMinDeposit('ghost'), 10, 'falls back to the floor');
  });
});
