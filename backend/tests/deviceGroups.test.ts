/**
 * Device groups: one phone, several accounts. The list must include accounts
 * that share a profile deviceId even when they never joined a match (no slot
 * snapshot yet), because that is exactly the case fraud review looks for.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

let fake: FakePrisma;
type DeviceApi = typeof import('../src/services/deviceGroup.service.js');
let deviceApi: DeviceApi;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  deviceApi = await import('../src/services/deviceGroup.service.js');
});

const tenantId = 'tenant-1';

function user(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId,
    role: 'USER',
    playerCode: `APE-${id}`,
    inGameName: `IGN_${id}`,
    isBanned: false,
    deviceId: null,
    ...overrides,
  };
}

beforeEach(() => {
  fake = new FakePrisma({
    users: [
      user('u1', { deviceId: 'phone-a' }),
      user('u2', { deviceId: 'phone-a' }),
      user('u3', { deviceId: 'phone-b' }),
    ],
    tournamentSlots: [],
    walletLedger: [
      { tenantId, userId: 'u1', category: 'WINNING_PRIZE', amount: 500 },
      { tenantId, userId: 'u2', category: 'ADD_MONEY', amount: 100 },
      { tenantId, userId: 'u2', category: 'WITHDRAWAL', amount: 40 },
    ],
    matchResults: [],
  });
});

it('groups two accounts that share a profile device but never played', async () => {
  const result = await deviceApi.listDeviceGroups(tenantId, { minAccounts: 2, limit: 10 });

  assert.equal(result.totalDevices, 2);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].deviceId, 'phone-a');
  assert.equal(result.groups[0].accountCount, 2);
  assert.equal(result.groups[0].collidedMatchCount, 0);
  assert.equal(result.groups[0].totalWinnings, 500);
  assert.equal(result.groups[0].netOut, -60);
});

it('counts a match where two accounts from the device both played', async () => {
  fake = new FakePrisma({
    users: [user('u1', { deviceId: 'phone-a' }), user('u2', { deviceId: 'phone-a' })],
    tournamentSlots: [
      { tenantId, userId: 'u1', tournamentId: 't1', deviceIdSnapshot: 'phone-a' },
      { tenantId, userId: 'u2', tournamentId: 't1', deviceIdSnapshot: 'phone-a' },
    ],
    walletLedger: [],
    matchResults: [],
  });

  const result = await deviceApi.listDeviceGroups(tenantId, { minAccounts: 2, limit: 10 });

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].collidedMatchCount, 1);
  assert.equal(result.groups[0].accountCount, 2);
});

it('ignores a lone account on its own device', async () => {
  fake = new FakePrisma({
    users: [user('u3', { deviceId: 'phone-b' })],
    tournamentSlots: [],
    walletLedger: [],
    matchResults: [],
  });

  const result = await deviceApi.listDeviceGroups(tenantId, { minAccounts: 2, limit: 10 });

  assert.equal(result.totalDevices, 1);
  assert.deepEqual(result.groups, []);
});
