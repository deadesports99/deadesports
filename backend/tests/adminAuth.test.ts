/**
 * Admin web auth: owner email + OTP, sub-admin owner-email + permission key +
 * OTP, session token, key issue/revoke/regenerate and audit rows.
 *
 * The real service runs against the in-memory Prisma fake, so this suite is a
 * byte-for-byte check of the production logic (no HTTP layer here).
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

const tenantId = 'tenant-1';
const ownerEmail = 'deadesports99@gmail.com';
const RAW_KEY = 'K7pQ2x9mR4tL8vN3sW5cB6dE';

let fake: FakePrisma;
type AdminAuthApi = typeof import('../src/services/adminAuth.service.js');
let api: AdminAuthApi;
let env: typeof import('../src/config/env.js').env;
let hashAccessKey: (key: string) => string;

before(async () => {
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as never, {
        get: (_target, prop: string) => (fake as unknown as Record<string, unknown>)[prop],
      }),
      disconnectPrisma: async () => {},
    },
  });

  api = await import('../src/services/adminAuth.service.js');
  env = (await import('../src/config/env.js')).env;
  hashAccessKey = (await import('../src/utils/accessKey.js')).hashAccessKey;
});

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    tenantId,
    phoneNumber: '9000000002',
    email: 'staff@example.com',
    name: 'Squad Manager',
    role: 'SUB_ADMIN',
    isBanned: false,
    canCreateMatch: true,
    canUpdateRoomId: false,
    canDistributePrize: false,
    canManageWallet: true,
    adminId: 'admin-1',
    playerCode: 'APE-0002',
    createdAt: new Date(),
    ...overrides,
  };
}

function seed(overrides: {
  users?: Record<string, unknown>[];
  staffAccessKeys?: Record<string, unknown>[];
} = {}) {
  fake = new FakePrisma({
    tenants: [
      {
        id: tenantId,
        subdomain: 'apex-ff',
        brandName: 'Apex Free Fire Club',
        isActive: true,
        allowEmailAuth: true,
      },
    ],
    users: overrides.users ?? [
      {
        id: 'admin-1',
        tenantId,
        phoneNumber: '9000000001',
        email: ownerEmail,
        name: 'Owner',
        role: 'ADMIN',
        isBanned: false,
        canCreateMatch: true,
        canUpdateRoomId: true,
        canDistributePrize: true,
        canManageWallet: true,
        playerCode: 'APE-0001',
        createdAt: new Date(),
      },
      staffRow(),
    ],
    staffAccessKeys: overrides.staffAccessKeys ?? [
      {
        id: 'key-1',
        tenantId,
        userId: 'staff-1',
        keyHash: hashAccessKey(RAW_KEY),
        keyHint: 'B6dE',
        permissions: { canCreateMatch: true, canManageWallet: true },
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
        createdAt: new Date(),
      },
    ],
  });
  api.invalidateAccessKeyCache();
}

const decode = (token: string) => jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;

beforeEach(() => seed());

describe('owner login (email + OTP)', () => {
  it('stores only the OTP hash and returns a dev debug code', async () => {
    const out = await api.requestAdminOtp({ email: '  Deadesports99@Gmail.com ', ip: '1.1.1.1' });

    assert.match(out.debugOtp ?? '', /^\d{6}$/);
    const rows = fake.rowsOf('emailOtp');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, ownerEmail, 'email normalised');
    assert.notEqual(rows[0].codeHash, out.debugOtp, 'plain code is never stored');
    assert.equal(rows[0].attempts, 0);
    assert.equal(rows[0].type, 'ADMIN_LOGIN');
  });

  it('signs the owner in with an ADMIN session', async () => {
    const sent = await api.requestAdminOtp({ email: ownerEmail });
    const out = await api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp! });

    assert.equal(out.user.role, 'ADMIN');
    assert.equal(out.user.id, 'admin-1');
    assert.equal(out.user.permissions.canManageWallet, true);

    const payload = decode(out.token);
    assert.equal(payload.userId, 'admin-1');
    assert.equal(payload.accessKeyId, undefined, 'owner has no key binding');
    assert.equal(fake.rowsOf('emailOtp').length, 0, 'code burned after use');
  });

  it('burns the code so it cannot be replayed', async () => {
    const sent = await api.requestAdminOtp({ email: ownerEmail });
    await api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp! });

    await assert.rejects(
      () => api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp! }),
      /invalid or expired/i,
    );
  });

  it('counts wrong attempts and refuses after five', async () => {
    const sent = await api.requestAdminOtp({ email: ownerEmail });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        () => api.verifyAdminOtp({ email: ownerEmail, otp: '000000' }),
        /invalid or expired/i,
      );
    }
    assert.equal(fake.rowsOf('emailOtp')[0].attempts, 5);

    // The correct code no longer works once the attempt budget is spent.
    await assert.rejects(
      () => api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp! }),
      /too many wrong codes/i,
    );
  });

  it('does not reveal whether an unknown email exists', async () => {
    const out = await api.requestAdminOtp({ email: 'nobody@example.com' });
    assert.match(out.message, /if this email has access/i);
    assert.equal(fake.rowsOf('emailOtp').length, 0, 'no OTP row for unknown email');
  });
});

describe('sub-admin login (owner email + permission key + OTP)', () => {
  it('requires a permission key for a staff account', async () => {
    await assert.rejects(
      () => api.requestAdminOtp({ email: 'staff@example.com' }),
      /permission key is required/i,
    );
  });

  it('issues a session bound to the key owner and the staff permissions', async () => {
    const sent = await api.requestAdminOtp({ email: ownerEmail, accessKey: RAW_KEY });
    const out = await api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp!, accessKey: RAW_KEY });

    assert.equal(out.user.id, 'staff-1');
    assert.equal(out.user.role, 'SUB_ADMIN');
    assert.equal(out.user.permissions.canCreateMatch, true);
    assert.equal(out.user.permissions.canDistributePrize, false);

    const payload = decode(out.token);
    assert.equal(payload.accessKeyId, 'key-1', 'session is bound to the permission key');
    assert.equal(fake.rowsOf('staffAccessKey')[0].lastUsedAt instanceof Date, true);
  });

  it('rejects a revoked key', async () => {
    seed({
      staffAccessKeys: [
        {
          id: 'key-1',
          tenantId,
          userId: 'staff-1',
          keyHash: hashAccessKey(RAW_KEY),
          keyHint: 'B6dE',
          expiresAt: null,
          revokedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () => api.requestAdminOtp({ email: ownerEmail, accessKey: RAW_KEY }),
      /invalid email, permission key or code/i,
    );
  });

  it('rejects an expired key', async () => {
    seed({
      staffAccessKeys: [
        {
          id: 'key-1',
          tenantId,
          userId: 'staff-1',
          keyHash: hashAccessKey(RAW_KEY),
          keyHint: 'B6dE',
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () => api.requestAdminOtp({ email: ownerEmail, accessKey: RAW_KEY }),
      /invalid email, permission key or code/i,
    );
  });

  it('rejects a key that belongs to another tenant / a non-admin email', async () => {
    seed({
      users: [
        {
          id: 'admin-2',
          tenantId: 'tenant-2',
          phoneNumber: '9000000009',
          email: 'other@example.com',
          name: 'Other owner',
          role: 'ADMIN',
          isBanned: false,
          canCreateMatch: true,
          canUpdateRoomId: true,
          canDistributePrize: true,
          canManageWallet: true,
          createdAt: new Date(),
        },
        staffRow(),
      ],
    });

    await assert.rejects(
      () => api.requestAdminOtp({ email: 'other@example.com', accessKey: RAW_KEY }),
      /invalid email, permission key or code/i,
    );
  });

  it('rejects a malformed key without touching the DB', async () => {
    await assert.rejects(
      () => api.requestAdminOtp({ email: ownerEmail, accessKey: 'too-short' }),
      /invalid email, permission key or code/i,
    );
  });
});

describe('owner-only access key management', () => {
  const owner = { userId: 'admin-1', tenantId };

  it('creates a sub-admin and returns the plain key exactly once', async () => {
    const out = await api.issueStaffAccess(owner, {
      name: 'New Staff',
      email: 'new.staff@example.com',
      phoneNumber: '+91 98765 43210',
      permissions: { canUpdateRoomId: true },
    });

    assert.match(out.accessKey, /^[A-Za-z0-9]{6}(-[A-Za-z0-9]{6}){3}$/, '6-6-6-6 groups');
    assert.equal(out.keyHint.length, 4);
    assert.equal(out.staff.role, 'SUB_ADMIN');
    assert.equal(out.staff.permissions.canUpdateRoomId, true);
    assert.equal(out.staff.permissions.canManageWallet, false);

    const stored = fake.rowsOf('staffAccessKey').find((row) => row.id === out.keyId)!;
    assert.notEqual(stored.keyHash, out.accessKey, 'plain key is never stored');
    assert.equal(stored.keyHash, hashAccessKey(out.accessKey));
    assert.equal(stored.permissions.canUpdateRoomId, true);
    assert.equal(fake.rowsOf('user').some((u) => u.email === 'new.staff@example.com'), true);
  });

  it('refuses to shadow the owner account', async () => {
    await assert.rejects(
      () =>
        api.issueStaffAccess(owner, {
          name: 'Fake Owner',
          email: ownerEmail,
          phoneNumber: '9999999999',
        }),
      /belongs to the owner/i,
    );
  });

  it('revokes a key and kills the existing session immediately', async () => {
    await api.assertAccessKeyUsable('key-1'); // warm the cache
    await api.revokeStaffAccess(owner, 'key-1');

    const row = fake.rowsOf('staffAccessKey').find((key) => key.id === 'key-1')!;
    assert.ok(row.revokedAt instanceof Date);

    await assert.rejects(() => api.assertAccessKeyUsable('key-1'), /no longer active/i);
    await assert.rejects(
      () => api.requestAdminOtp({ email: ownerEmail, accessKey: RAW_KEY }),
      /invalid email, permission key or code/i,
    );
  });

  it('regenerates: old key dies, new key works', async () => {
    const fresh = await api.regenerateStaffAccess(owner, 'key-1');

    assert.notEqual(fresh.accessKey, RAW_KEY);
    assert.equal(fresh.keyHint, fresh.accessKey.replace(/-/g, '').slice(-4));

    await assert.rejects(
      () => api.requestAdminOtp({ email: ownerEmail, accessKey: RAW_KEY }),
      /invalid email, permission key or code/i,
    );

    const sent = await api.requestAdminOtp({ email: ownerEmail, accessKey: fresh.accessKey });
    assert.match(sent.debugOtp ?? '', /^\d{6}$/);
  });

  it('lists keys with a live status', async () => {
    seed({
      staffAccessKeys: [
        {
          id: 'key-active',
          tenantId,
          userId: 'staff-1',
          keyHash: hashAccessKey(RAW_KEY),
          keyHint: 'B6dE',
          expiresAt: new Date(Date.now() + 86_400_000),
          revokedAt: null,
          createdAt: new Date(),
        },
        {
          id: 'key-revoked',
          tenantId,
          userId: 'staff-1',
          keyHash: hashAccessKey('A7pQ2x9mR4tL8vN3sW5cB6dE'),
          keyHint: 'B6dE',
          expiresAt: null,
          revokedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });

    const rows = await api.listStaffAccess(tenantId);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.status).sort(),
      ['ACTIVE', 'REVOKED'],
    );
    assert.equal(rows.every((row) => row.email === 'staff@example.com'), true);
  });

  it('writes audit rows for login, issue and revoke', async () => {
    const sent = await api.requestAdminOtp({ email: ownerEmail });
    await api.verifyAdminOtp({ email: ownerEmail, otp: sent.debugOtp! });
    const issued = await api.issueStaffAccess(owner, {
      name: 'Audit Staff',
      email: 'audit@example.com',
      phoneNumber: '9888888888',
    });
    await api.revokeStaffAccess(owner, issued.keyId);

    const actions = fake.rowsOf('adminAuditLog').map((row) => row.action);
    assert.equal(actions.includes('ADMIN_LOGIN'), true);
    assert.equal(actions.includes('STAFF_ACCESS_ISSUED'), true);
    assert.equal(actions.includes('STAFF_ACCESS_REVOKED'), true);
  });
});
