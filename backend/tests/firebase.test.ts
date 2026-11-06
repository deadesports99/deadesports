/**
 * Firebase token verification: the JWT-claims fallback that keeps logins working
 * when the Admin SDK is unreachable, plus the junk-token doors.
 *
 * The `mock_otp_` / `mock_google_` bypass tests are gone together with the
 * production code they covered (see PRODUCTION_CLOUD_EXECUTION_PLAN.md V2-B);
 * test auth now goes through `tests/helpers/fakeFirebase.ts`.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';

type FbApi = typeof import('../src/services/firebase.service.js');
let fb: FbApi;

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'deadesports-865d2';
const ID_TOKEN = (claims: Record<string, unknown>) => jwt.sign(claims, 'ignored-signature');

// The Admin SDK is NOT mocked: with no service account configured it fails, which
// is exactly the degraded path we want to verify (JWT-claims fallback).
const claimsToken = (extra: Record<string, unknown>) =>
  ID_TOKEN({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, ...extra });

before(async () => {
  fb = await import('../src/services/firebase.service.js');
});

describe('normalizePhoneNumber', () => {
  it('handles +91, plain 10-digit and international numbers', () => {
    assert.deepEqual(fb.normalizePhoneNumber('+919999900001'), { e164: '+919999900001', national: '9999900001' });
    assert.deepEqual(fb.normalizePhoneNumber('9999900001'), { e164: '+919999900001', national: '9999900001' });
    assert.deepEqual(fb.normalizePhoneNumber('91-99999-00001'), { e164: '+919999900001', national: '9999900001' });
    assert.equal(fb.normalizePhoneNumber('+1 415 555 0100').e164, '+14155550100');
  });
});

describe('getFirebaseApp', () => {
  it('is a cached singleton and never throws', () => {
    const first = fb.getFirebaseApp();
    const second = fb.getFirebaseApp();
    assert.equal(first, second, 'cached (or both null when unconfigured)');
  });
});

describe('verifyFirebasePhoneToken', () => {
  it('rejects junk and empty tokens', async () => {
    await assert.rejects(() => fb.verifyFirebasePhoneToken('not-a-real-token'), /Invalid or expired/i);
    await assert.rejects(() => fb.verifyFirebasePhoneToken(''), /idToken is required/i);
  });

  it('falls back to the Firebase JWT claims when the SDK fails', async () => {
    const good = claimsToken({ phone_number: '+919999900003', user_id: 'uid-from-claims' });
    const out = await fb.verifyFirebasePhoneToken(good);
    assert.equal(out.uid, 'uid-from-claims');
    assert.equal(out.national, '9999900003');

    const wrongIssuer = ID_TOKEN({ iss: 'https://evil.example', aud: PROJECT, phone_number: '+919999900004' });
    await assert.rejects(() => fb.verifyFirebasePhoneToken(wrongIssuer), /Invalid or expired/i);

    const noPhone = claimsToken({});
    await assert.rejects(() => fb.verifyFirebasePhoneToken(noPhone), /Invalid or expired/i);
  });
});

describe('verifyFirebaseGoogleToken', () => {
  it('rejects junk and empty tokens', async () => {
    await assert.rejects(() => fb.verifyFirebaseGoogleToken('obviously-invalid'), /Invalid or expired/i);
    await assert.rejects(() => fb.verifyFirebaseGoogleToken(''), /idToken is required/i);
  });

  it('falls back to Firebase JWT claims, and rejects a foreign token', async () => {
    const good = claimsToken({ email: 'Fallback@Example.com', name: 'Fallback Gamer', sub: 'sub-1' });
    const out = await fb.verifyFirebaseGoogleToken(good);
    assert.equal(out.email, 'fallback@example.com');
    assert.equal(out.uid, 'sub-1');

    const foreign = ID_TOKEN({ iss: 'https://evil.example', aud: 'someone-else', email: 'x@y.com' });
    await assert.rejects(() => fb.verifyFirebaseGoogleToken(foreign), /Invalid or expired/i);
  });
});

describe('development login (DEV_FAKE_FIREBASE)', () => {
  const previous = process.env.DEV_FAKE_FIREBASE;

  after(() => {
    if (previous === undefined) delete process.env.DEV_FAKE_FIREBASE;
    else process.env.DEV_FAKE_FIREBASE = previous;
  });

  it('accepts dev tokens only when the flag is on in development', async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.DEV_FAKE_FIREBASE = 'true';
    try {
      assert.equal(fb.isDevAuthEnabled(), true);
      const phone = await fb.verifyFirebasePhoneToken('dev_otp_9812345678');
      assert.deepEqual(phone, { uid: 'dev_9812345678', e164: '+919812345678', national: '9812345678' });
      const google = await fb.verifyFirebaseGoogleToken('dev_google_ravi');
      assert.equal(google.uid, 'dev_ravi');

      // Same token, production process -> refused.
      process.env.NODE_ENV = 'production';
      await assert.rejects(() => fb.verifyFirebasePhoneToken('dev_otp_9812345678'), /Invalid or expired/i);
      assert.throws(() => fb.assertDevAuthConfig(), /not allowed in production/i);
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });

  it('never accepts dev tokens when the flag is off', async () => {
    process.env.DEV_FAKE_FIREBASE = 'false';
    assert.equal(fb.isDevAuthEnabled(), false);
    await assert.rejects(() => fb.verifyFirebasePhoneToken('dev_otp_9812345678'), /Invalid or expired/i);
    await assert.rejects(() => fb.verifyFirebaseGoogleToken('dev_google_ravi'), /Invalid or expired/i);
  });
});
