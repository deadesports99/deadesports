/**
 * Phase 3 — auth consolidation (firebaseUid link + production auth guards).
 *
 * What is proven here:
 *  1. every successful Firebase-authenticated login records the verified UID;
 *  2. a legacy row (UID null) is backfilled on its next login;
 *  3. an already-correct UID triggers no write at all (no needless UPDATE per login);
 *  4. if the column is missing in the database, login still works — the write is
 *     best-effort, so release order can never lock players out;
 *  5. a production process refuses to boot with an auth bypass flag turned on.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';
import { registerFakeFirebase, setFakeGoogleUser } from './helpers/fakeFirebase.js';

process.env.PHONE_OTP_ENABLED = 'true';
process.env.PHONE_OTP_BYPASS = 'false';

type AuthApi = typeof import('../src/services/auth.service.js');
type FirebaseApi = typeof import('../src/services/firebase.service.js');

let fake: FakePrisma;
let api: AuthApi;
let fb: FirebaseApi;

const tenantId = 'tenant-1';

before(async () => {
  await registerFakeFirebase();
  mock.module('../src/config/prisma.js', {
    namedExports: {
      prisma: new Proxy({} as any, { get: (_t, prop: string) => (fake as any)[prop] }),
      disconnectPrisma: async () => {},
    },
  });
  api = await import('../src/services/auth.service.js');
  fb = await import('../src/services/firebase.service.js');
});

function seed(users: any[] = []) {
  fake = new FakePrisma({
    tenants: [
      {
        id: tenantId,
        subdomain: 'thunder',
        brandName: 'Thunder eSports',
        isActive: true,
        allowPhoneAuth: true,
        allowGoogleAuth: true,
        allowEmailAuth: true,
      },
    ],
    users,
  });
  return fake;
}

const player = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-existing',
  tenantId,
  phoneNumber: '9999900001',
  email: null,
  firebaseUid: null,
  role: 'USER',
  isBanned: false,
  ...overrides,
});

const userUpdates = () => fake.calls.filter((c) => c.model === 'user' && c.op === 'update');

describe('firebaseUid — phone registration', () => {
  beforeEach(() => seed());

  it('stores the verified Firebase UID on the new account', async () => {
    const { user } = await api.registerPlayer({
      tenantId,
      idToken: 'mock_otp_9820011122',
      name: 'Ravi',
    });

    const row = fake.store.user.find((u) => u.id === user.id)!;
    assert.equal(row.firebaseUid, 'mock_9820011122');
    assert.equal(userUpdates().length, 1, 'exactly one linking write');
  });
});

describe('firebaseUid — Google login', () => {
  beforeEach(() => seed());

  it('stores the verified Google UID for a new player', async () => {
    setFakeGoogleUser({ uid: 'google-uid-1', email: 'new@gmail.com', name: 'New Gamer' });

    const { user } = await api.googleLoginOrRegister({
      tenantId,
      idToken: 'mock_google_new',
    });

    const row = fake.store.user.find((u) => u.id === user.id)!;
    assert.equal(row.firebaseUid, 'google-uid-1');
  });

  it('never exposes the UID in the sanitized API payload', async () => {
    setFakeGoogleUser({ uid: 'google-uid-2', email: 'hidden@gmail.com' });

    const { user } = await api.googleLoginOrRegister({
      tenantId,
      idToken: 'mock_google_hidden',
    });

    assert.equal('firebaseUid' in (user as Record<string, unknown>), false);
  });
});

describe('firebaseUid — backfill on next login', () => {
  it('fills a legacy row that has no UID yet', async () => {
    seed([player({ firebaseUid: null })]);

    const { user } = await api.loginWithPhone({
      tenantId,
      idToken: 'mock_otp_9999900001',
    });

    const row = fake.store.user.find((u) => u.id === user.id)!;
    assert.equal(row.firebaseUid, 'mock_9999900001');
    assert.equal(userUpdates().length, 1);
  });

  it('writes nothing when the UID already matches', async () => {
    seed([player({ firebaseUid: 'mock_9999900001' })]);

    const { user } = await api.loginWithPhone({
      tenantId,
      idToken: 'mock_otp_9999900001',
    });

    assert.equal(user.firebaseUid === undefined, true, 'UID is not part of the API payload');
    assert.equal(userUpdates().length, 0, 'no needless UPDATE on every login');
  });
});

describe('firebaseUid — deploy-order safety', () => {
  it('lets the player log in even when the column write fails', async () => {
    seed([player({ firebaseUid: null })]);

    // Simulate a database where `prisma db push` has not run yet.
    const realUser = fake.user;
    Object.defineProperty(fake, 'user', {
      configurable: true,
      get: () => ({
        ...realUser,
        update: async () => {
          throw new Error('column "firebaseUid" of relation "User" does not exist');
        },
      }),
    });

    const result = await api.loginWithPhone({
      tenantId,
      idToken: 'mock_otp_9999900001',
    });

    assert.ok(result.token, 'login still returns a token');
    assert.equal(result.user.phoneNumber, '9999900001');
  });

  it('linkFirebaseUid is a no-op without a uid and never throws', async () => {
    seed([]);
    await assert.doesNotReject(() => api.linkFirebaseUid('u-1', undefined));
    await assert.doesNotReject(() => api.linkFirebaseUid('u-1', '   '));

    seed([player({ id: 'u-1' })]);
    await assert.doesNotReject(() => api.linkFirebaseUid('u-1', 'same', 'same'));
    assert.equal(userUpdates().length, 0);
  });
});

describe('production auth guards', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousBypass = process.env.PHONE_OTP_BYPASS;
  const previousDev = process.env.DEV_FAKE_FIREBASE;

  function restore(): void {
    process.env.NODE_ENV = previousEnv;
    if (previousBypass === undefined) delete process.env.PHONE_OTP_BYPASS;
    else process.env.PHONE_OTP_BYPASS = previousBypass;
    if (previousDev === undefined) delete process.env.DEV_FAKE_FIREBASE;
    else process.env.DEV_FAKE_FIREBASE = previousDev;
  }

  it('refuses to boot production with PHONE_OTP_BYPASS=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.PHONE_OTP_BYPASS = 'true';
    delete process.env.DEV_FAKE_FIREBASE;
    try {
      assert.throws(() => fb.assertDevAuthConfig(), /PHONE_OTP_BYPASS=true is not allowed/);
    } finally {
      restore();
    }
  });

  it('still refuses DEV_FAKE_FIREBASE in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PHONE_OTP_BYPASS = 'false';
    process.env.DEV_FAKE_FIREBASE = 'true';
    try {
      assert.throws(() => fb.assertDevAuthConfig(), /DEV_FAKE_FIREBASE=true is not allowed/);
    } finally {
      restore();
    }
  });

  it('allows both flags in development and neither in a clean production config', () => {
    process.env.NODE_ENV = 'development';
    process.env.PHONE_OTP_BYPASS = 'true';
    process.env.DEV_FAKE_FIREBASE = 'true';
    try {
      assert.doesNotThrow(() => fb.assertDevAuthConfig());
    } finally {
      restore();
    }

    process.env.NODE_ENV = 'production';
    process.env.PHONE_OTP_BYPASS = 'false';
    delete process.env.DEV_FAKE_FIREBASE;
    try {
      assert.doesNotThrow(() => fb.assertDevAuthConfig());
    } finally {
      restore();
    }
  });
});
