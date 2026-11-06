/**
 * Login paths: phone OTP, Google one-tap, email + 6-digit code, and the admin's
 * staff (SUB_ADMIN) management. These are the doors into every other feature.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

let fake: FakePrisma;
type AuthApi = typeof import('../src/services/auth.service.js');
let api: AuthApi;
let env: typeof import('../src/config/env.js').env;

/** Google tokens are stubbed; phone tokens use the real mock_otp_ bypass. */
let googleUser: Record<string, unknown> | null = null;

before(async () => {
  const realFirebase = await import('../src/services/firebase.service.js');
  mock.module('../src/services/firebase.service.js', {
    namedExports: {
      ...realFirebase,
      verifyFirebaseGoogleToken: async () => {
        if (!googleUser) throw new Error('Invalid Google token');
        return googleUser;
      },
    },
  });
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  env = (await import('../src/config/env.js')).env;
  api = await import('../src/services/auth.service.js');
});

const tenantId = 'tenant-1';
const admin = { id: 'admin-1', tenantId, role: 'ADMIN' as const };

function seed(over: { users?: any[]; tenant?: Record<string, unknown>; emailOtps?: any[] } = {}) {
  fake = new FakePrisma({
    tenants: [
      { id: tenantId, brandName: 'Thunder', isActive: true, allowPhoneAuth: true, allowEmailAuth: true, ...over.tenant },
    ],
    users: over.users ?? [
      {
        id: 'user-1',
        tenantId,
        phoneNumber: '9999900001',
        email: 'player@example.com',
        passwordHash: api.hashPassword('secret123'),
        playerCode: 'THU-0001',
        role: 'USER',
        isBanned: false,
        depositBalance: 0,
        winningBalance: 0,
      },
      {
        ...admin,
        phoneNumber: '9999900009',
        email: 'admin@example.com',
        playerCode: 'THU-0009',
        isBanned: false,
      },
      {
        id: 'staff-1',
        tenantId,
        phoneNumber: '9999900002',
        email: 'staff@example.com',
        playerCode: 'THU-0002',
        role: 'SUB_ADMIN',
        adminId: 'admin-1',
        isBanned: false,
        canCreateMatch: true,
        canUpdateRoomId: false,
        canDistributePrize: false,
        canManageWallet: false,
        createdAt: new Date('2026-01-01'),
      },
    ],
    emailOtps: over.emailOtps ?? [],
  });
  return fake;
}

const decode = (token: string) => jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string };

describe('loginWithPhone', () => {
  beforeEach(() => seed());

  it('logs in a registered number with a verified Firebase token', async () => {
    const out = await api.loginWithPhone({ tenantId, idToken: 'mock_otp_9999900001' });
    assert.equal(out.user.phoneNumber, '9999900001');
    assert.equal(out.user.playerCode, 'THU-0001');
    assert.equal(decode(out.token).userId, 'user-1');
    assert.equal((out.user as any).passwordHash, undefined, 'hash never leaves the server');
  });

  it('rejects unknown numbers, banned accounts and disabled phone auth', async () => {
    await assert.rejects(
      () => api.loginWithPhone({ tenantId, idToken: 'mock_otp_9000000000' }),
      /not registered/i,
    );

    seed({ users: [{ id: 'u-banned', tenantId, phoneNumber: '9000000001', isBanned: true, role: 'USER' }] });
    await assert.rejects(
      () => api.loginWithPhone({ tenantId, idToken: 'mock_otp_9000000001' }),
      /banned/i,
    );

    seed({ tenant: { allowPhoneAuth: false } });
    await assert.rejects(
      () => api.loginWithPhone({ tenantId, idToken: 'mock_otp_9999900001' }),
      /Phone OTP authentication is currently disabled/i,
    );
  });

  it('demands a Firebase token and an active tenant', async () => {
    await assert.rejects(() => api.loginWithPhone({ tenantId }), /idToken is required/i);
    await assert.rejects(
      () => api.loginWithPhone({ tenantId: 'ghost', idToken: 'mock_otp_9999900001' }),
      /Tenant not found/i,
    );
    seed({ tenant: { isActive: false } });
    await assert.rejects(
      () => api.loginWithPhone({ tenantId, idToken: 'mock_otp_9999900001' }),
      /inactive/i,
    );
  });
});

describe('googleLoginOrRegister', () => {
  beforeEach(() => {
    seed();
    googleUser = null;
  });

  it('creates a player on first Google sign-in', async () => {
    googleUser = { uid: 'g-123456789', email: 'new@gmail.com', name: 'New Gamer' };

    const out = await api.googleLoginOrRegister({ tenantId, idToken: 'google-token' });
    assert.equal(out.user.email, 'new@gmail.com');
    assert.equal(out.user.name, 'New Gamer');
    assert.equal(out.user.phoneNumber, 'G123456789', 'placeholder phone keeps the unique index happy');
    assert.match(out.user.playerCode ?? '', /^THU-\d{4}$/);
  });

  it('logs an existing player in, but never a banned one', async () => {
    googleUser = { uid: 'g-1', email: 'player@example.com', name: 'Ravi' };
    const out = await api.googleLoginOrRegister({ tenantId, idToken: 'google-token' });
    assert.equal(out.user.id, 'user-1');
    assert.equal(fake.rowsOf('user').length, 3, 'no duplicate account');

    seed({
      users: [{ id: 'u-banned', tenantId, email: 'bad@example.com', isBanned: true, phoneNumber: '9', role: 'USER' }],
    });
    googleUser = { uid: 'g-2', email: 'bad@example.com' };
    await assert.rejects(
      () => api.googleLoginOrRegister({ tenantId, idToken: 'google-token' }),
      /banned/i,
    );
  });

  it('fails closed when the Google token cannot be verified', async () => {
    await assert.rejects(
      () => api.googleLoginOrRegister({ tenantId, idToken: 'broken' }),
      /Invalid Google token/,
    );
  });
});

describe('email + OTP auth', () => {
  beforeEach(() => seed());

  it('sends a 6-digit code and replaces the previous one', async () => {
    seed({
      emailOtps: [{ id: 'old', tenantId, email: 'player@example.com', code: '111111', type: 'LOGIN' }],
    });

    const out = await api.sendEmailOtp({
      tenantId,
      email: '  Player@Example.com ',
      password: 'secret123',
      type: 'LOGIN',
    });

    assert.equal(out.email, 'player@example.com', 'normalised');
    assert.match(out.debugOtp ?? '', /^\d{6}$/);
    const stored = fake.rowsOf('emailOtp');
    assert.equal(stored.length, 1, 'old code deleted');
    assert.equal(stored[0].code, out.debugOtp);
    assert.ok(new Date(stored[0].expiresAt).getTime() > Date.now());
  });

  it('blocks wrong passwords, banned users, short passwords and duplicate emails', async () => {
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'player@example.com', password: 'nope', type: 'LOGIN' }),
      /Invalid email or password/i,
    );
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'ghost@example.com', password: 'secret123', type: 'LOGIN' }),
      /Invalid email or password/i,
    );
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'a@b.com', password: '123', type: 'REGISTER' }),
      /at least 6 characters/i,
    );
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'player@example.com', password: 'secret123', type: 'REGISTER' }),
      /already exists/i,
    );

    seed({ users: [{ id: 'u-banned', tenantId, email: 'bad@example.com', passwordHash: api.hashPassword('secret123'), isBanned: true, phoneNumber: '9', role: 'USER' }] });
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'bad@example.com', password: 'secret123', type: 'LOGIN' }),
      /banned/i,
    );
  });

  it('registers a new player when the code matches', async () => {
    const sent = await api.sendEmailOtp({
      tenantId,
      email: 'fresh@example.com',
      password: 'strongpass',
      name: 'Fresh',
      type: 'REGISTER',
    });

    const out = await api.verifyEmailOtp({
      tenantId,
      email: 'fresh@example.com',
      code: sent.debugOtp!,
      password: 'strongpass',
      name: 'Fresh',
      type: 'REGISTER',
    });

    assert.equal(out.user.email, 'fresh@example.com');
    assert.equal(out.user.name, 'Fresh');
    assert.match(out.user.phoneNumber, /^E\d{9}$/);
    const stored = fake.rowsOf('user').find((u) => u.email === 'fresh@example.com')!;
    assert.ok(stored.passwordHash, 'password stored as a hash');
    assert.notEqual(stored.passwordHash, 'strongpass');
    assert.ok(api.verifyPassword('strongpass', stored.passwordHash));
    assert.equal(fake.rowsOf('emailOtp').length, 0, 'code burned after use');
  });

  it('rejects wrong or expired codes and re-used ones', async () => {
    const sent = await api.sendEmailOtp({ tenantId, email: 'player@example.com', password: 'secret123', type: 'LOGIN' });

    await assert.rejects(
      () => api.verifyEmailOtp({ tenantId, email: 'player@example.com', code: '000000', type: 'LOGIN' }),
      /Invalid or expired/i,
    );

    seed({
      emailOtps: [
        {
          id: 'expired',
          tenantId,
          email: 'player@example.com',
          code: '222222',
          type: 'LOGIN',
          expiresAt: new Date(Date.now() - 1000),
        },
      ],
    });
    await assert.rejects(
      () => api.verifyEmailOtp({ tenantId, email: 'player@example.com', code: '222222', type: 'LOGIN' }),
      /Invalid or expired/i,
    );

    seed({
      emailOtps: [
        {
          id: 'ok',
          tenantId,
          email: 'player@example.com',
          code: sent.debugOtp!,
          type: 'LOGIN',
          expiresAt: new Date(Date.now() + 600_000),
        },
      ],
    });
    const login = await api.verifyEmailOtp({
      tenantId,
      email: 'player@example.com',
      code: sent.debugOtp!,
      type: 'LOGIN',
    });
    assert.equal(decode(login.token).userId, 'user-1');

    await assert.rejects(
      () => api.verifyEmailOtp({ tenantId, email: 'player@example.com', code: sent.debugOtp!, type: 'LOGIN' }),
      /Invalid or expired/i,
      'a used code cannot be replayed',
    );
  });

  it('honours the email-auth switch', async () => {
    seed({ tenant: { allowEmailAuth: false } });
    await assert.rejects(
      () => api.sendEmailOtp({ tenantId, email: 'player@example.com', password: 'secret123', type: 'LOGIN' }),
      /Email authentication is currently disabled/i,
    );
  });
});

describe('staff (SUB_ADMIN) management', () => {
  beforeEach(() => seed());

  it('hires a staff member with normalised permissions', async () => {
    const out = await api.createStaffMember(admin, {
      name: 'Aman',
      email: 'AMAN@Example.com',
      phoneNumber: '+91 99999 00003',
      permissions: { canCreateMatch: true, canManageWallet: true } as any,
    });

    assert.equal(out.user.role, 'SUB_ADMIN');
    assert.equal(out.user.email, 'aman@example.com');
    assert.equal(out.user.phoneNumber, '9999900003');
    assert.deepEqual(out.user.permissions, {
      canCreateMatch: true,
      canUpdateRoomId: false,
      canDistributePrize: false,
      canManageWallet: true,
    });
    assert.match(out.user.playerCode ?? '', /^THU-\d{4}$/);
  });

  it('only the admin may hire, and emails/phones must be unique', async () => {
    await assert.rejects(
      () =>
        api.createStaffMember({ id: 'staff-1', tenantId, role: 'SUB_ADMIN' } as any, {
          name: 'X',
          email: 'x@example.com',
          phoneNumber: '9000000001',
        }),
      /Only the admin can create staff/i,
    );

    await assert.rejects(
      () =>
        api.createStaffMember(admin, {
          name: 'Dup',
          email: 'staff@example.com',
          phoneNumber: '9000000002',
        }),
      /Email already in use/i,
    );

    await assert.rejects(
      () =>
        api.createStaffMember(admin, {
          name: 'Dup',
          email: 'unique@example.com',
          phoneNumber: '9999900001',
        }),
      /already registered/i,
    );
  });

  it('lists, updates and deactivates staff without deleting history', async () => {
    const list = await api.listStaffMembers(admin);
    assert.equal(list.count, 1);
    assert.equal(list.staff[0].email, 'staff@example.com');
    assert.deepEqual(list.staff[0].permissions, {
      canCreateMatch: true,
      canUpdateRoomId: false,
      canDistributePrize: false,
      canManageWallet: false,
    });

    const updated = await api.updateStaffMember(admin, 'staff-1', {
      name: 'Aman Updated',
      permissions: { canDistributePrize: true } as any,
    });
    assert.equal(updated.name, 'Aman Updated');
    assert.equal(updated.permissions.canDistributePrize, true);
    assert.equal(updated.permissions.canCreateMatch, false, 'unspecified permissions become false');

    const deactivated = await api.updateStaffMember(admin, 'staff-1', { isActive: false });
    assert.equal(deactivated.isBanned, true);

    const removed = await api.removeStaffMember(admin, 'staff-1');
    assert.equal(removed.isBanned, true);
    assert.equal(removed.permissions.canManageWallet, false);
    assert.equal(fake.rowsOf('user').find((u) => u.id === 'staff-1') !== undefined, true, 'row kept for audit');
  });

  it('protects other tenants staff and non-admin callers', async () => {
    const outlooker = { id: 'admin-2', tenantId: 'tenant-2', role: 'ADMIN' as const };
    await assert.rejects(() => api.removeStaffMember(outlooker, 'staff-1'), /Staff member not found/i);
    await assert.rejects(
      () => api.removeStaffMember({ id: 'staff-1', tenantId, role: 'SUB_ADMIN' } as any, 'staff-1'),
      /Only the admin can manage staff/i,
    );
  });
});

describe('profile + push token', () => {
  beforeEach(() => seed());

  it('returns the caller profile and 404s for unknown ids', async () => {
    const me = await api.getUserProfile('user-1');
    assert.equal(me.phoneNumber, '9999900001');
    await assert.rejects(() => api.getUserProfile('ghost'), /User not found/i);
  });

  it('stores a device push token and rejects junk', async () => {
    await assert.rejects(() => api.saveFcmToken('user-1', 'short'), /Invalid FCM token/i);
    const out = await api.saveFcmToken('user-1', '  c'.padEnd(40, 'x').trim() + '  ');
    assert.equal(out.registered, true);
    assert.equal(fake.rowsOf('user').find((u) => u.id === 'user-1')?.fcmToken?.length, 38);
  });
});
