import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';
import { registerFakeFirebase } from './helpers/fakeFirebase.js';

let fake: FakePrisma;
type AuthApi = typeof import('../src/services/auth.service.js');
let api: AuthApi;

before(async () => {
  await registerFakeFirebase();
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/auth.service.js');
});

const tenantId = 'tenant-1';

function seed(opts: { tenant?: any; users?: any[] } = {}) {
  fake = new FakePrisma({
    tenants: [{ id: tenantId, subdomain: 'thunder', brandName: 'Thunder eSports', isActive: true, allowPhoneAuth: true, ...opts.tenant }],
    users: opts.users ?? [],
  });
  return fake;
}

describe('password hashing', () => {
  it('stores a unique salt per hash and never the raw password', () => {
    const a = api.hashPassword('Sup3rSecret!');
    const b = api.hashPassword('Sup3rSecret!');
    assert.notEqual(a, b, 'salts must differ');
    assert.match(a, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(a.includes('Sup3rSecret!'), false);
  });

  it('verifies the correct password and rejects everything else', () => {
    const hash = api.hashPassword('Sup3rSecret!');
    assert.equal(api.verifyPassword('Sup3rSecret!', hash), true);
    assert.equal(api.verifyPassword('sup3rsecret!', hash), false);
    assert.equal(api.verifyPassword('', hash), false);
  });

  it('returns false (instead of throwing) for malformed stored hashes', () => {
    assert.equal(api.verifyPassword('x', 'not-a-hash'), false);
    assert.equal(api.verifyPassword('x', ''), false);
    assert.equal(api.verifyPassword('x', 'onlysalt:'), false);
  });
});

describe('generateToken', () => {
  it('signs a JWT carrying userId, tenantId and role', () => {
    const token = api.generateToken({ userId: 'u1', tenantId, role: 'USER' } as any);
    const decoded = jwt.decode(token, { complete: true }) as any;
    assert.equal(decoded.payload.userId, 'u1');
    assert.equal(decoded.payload.tenantId, tenantId);
    assert.equal(decoded.payload.role, 'USER');
    assert.equal(decoded.payload.iss, 'freefire-tournament-api');
    assert.equal(decoded.payload.aud, 'freefire-tournament-apps');
    assert.ok(decoded.payload.exp > decoded.payload.iat);
  });
});

describe('sanitizeUser', () => {
  it('drops secrets and exposes an explicit permission object', () => {
    const user: any = {
      id: 'u1', tenantId, phoneNumber: '9999900001', email: null, name: 'Ravi',
      inGameName: 'RaVi', inGameUid: '123456', role: 'SUB_ADMIN',
      canCreateMatch: true, canUpdateRoomId: false, canDistributePrize: true, canManageWallet: false,
      adminId: 'admin-1', depositBalance: '150.00', winningBalance: '25.50', isBanned: false,
      playerCode: 'THU-0007', deviceId: 'dev-1', createdAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: 'must-not-leak', otpSecret: 'nope', fcmToken: 'secret-token',
    };

    const safe: any = api.sanitizeUser(user);

    assert.equal(safe.passwordHash, undefined);
    assert.equal(safe.otpSecret, undefined);
    assert.equal(safe.fcmToken, undefined);
    assert.deepEqual(safe.permissions, {
      canCreateMatch: true,
      canUpdateRoomId: false,
      canDistributePrize: true,
      canManageWallet: false,
    });
    assert.equal(safe.depositBalance, '150.00');
    assert.equal(safe.playerCode, 'THU-0007');
  });
});

describe('registerPlayer', () => {
  beforeEach(() => seed());

  it('creates a USER account with an auto player code and a valid token', async () => {
    const out = await api.registerPlayer({
      tenantId,
      idToken: 'mock_otp_9876543210',
      inGameName: 'RaVi',
      inGameUid: '123456789',
      deviceId: 'device-1',
    });

    assert.equal(out.user.role, 'USER');
    assert.equal(out.user.phoneNumber, '9876543210');
    assert.equal(out.user.playerCode, 'THU-0001');
    assert.equal(out.user.inGameName, 'RaVi');

    const row = fake.rowsOf('user')[0];
    assert.equal(row.tenantId, tenantId);
    assert.equal(row.deviceId, 'device-1');

    const decoded = jwt.decode(out.token) as any;
    assert.equal(decoded.userId, row.id);
    assert.equal(decoded.tenantId, tenantId);
  });

  it('increments the player code per tenant', async () => {
    seed({ users: [{ id: 'u-old', tenantId, playerCode: 'THU-0041' }] });
    const out = await api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210' });
    assert.equal(out.user.playerCode, 'THU-0042');
  });

  it('blocks a duplicate phone number in the same tenant', async () => {
    seed({ users: [{ id: 'u-old', tenantId, phoneNumber: '9876543210' }] });
    await assert.rejects(
      () => api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210' }),
      /already registered/i,
    );
  });

  it('blocks a duplicate Free Fire UID', async () => {
    seed({ users: [{ id: 'u-old', tenantId, phoneNumber: '9000000000', inGameUid: '123456789' }] });
    await assert.rejects(
      () => api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210', inGameUid: '123456789' }),
      /Free Fire UID is already registered/i,
    );
  });

  it('enforces the 2-accounts-per-device anti-fraud rule', async () => {
    seed({
      users: [
        { id: 'a', tenantId, deviceId: 'device-1', phoneNumber: '9000000001' },
        { id: 'b', tenantId, deviceId: 'device-1', phoneNumber: '9000000002' },
      ],
    });
    await assert.rejects(
      () => api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210', deviceId: 'device-1' }),
      /Maximum 2 accounts/i,
    );
  });

  it('rejects missing tenant, inactive tenant and disabled phone auth', async () => {
    await assert.rejects(() => api.registerPlayer({ tenantId: 'ghost', idToken: 'mock_otp_9876543210' }), /Tenant not found/i);

    seed({ tenant: { isActive: false } });
    await assert.rejects(() => api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210' }), /inactive/i);

    seed({ tenant: { allowPhoneAuth: false } });
    await assert.rejects(() => api.registerPlayer({ tenantId, idToken: 'mock_otp_9876543210' }), /disabled/i);
  });

  it('requires a Firebase idToken', async () => {
    await assert.rejects(() => api.registerPlayer({ tenantId }), /idToken is required/i);
  });
});
