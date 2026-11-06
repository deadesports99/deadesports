/**
 * Test-only stand-in for `src/services/firebase.service.ts`.
 *
 * The production module used to carry `mock_otp_` / `mock_google_` string bypasses
 * guarded by `NODE_ENV !== 'production'`. That is exactly the kind of shortcut that
 * survives a bad deploy, so the bypasses were deleted from production code and live
 * here instead — reachable only from a test file that imports this helper.
 *
 * Usage (must run in `before()`, before the modules under test are imported):
 *
 *   import { registerFakeFirebase } from './helpers/fakeFirebase.js';
 *   before(async () => { await registerFakeFirebase(); ... });
 */
import { mock } from 'node:test';

/** Returned by `verifyFirebaseGoogleToken` for any `mock_google_*` token. */
let googleUser: Record<string, unknown> | null = null;

/** A test can swap the Google identity between cases. */
export function setFakeGoogleUser(user: Record<string, unknown> | null): void {
  googleUser = user;
}

export async function registerFakeFirebase(): Promise<void> {
  const real = await import('../../src/services/firebase.service.js');

  mock.module('../../src/services/firebase.service.js', {
    namedExports: {
      ...real,

      async verifyFirebasePhoneToken(idToken: string) {
        if (typeof idToken === 'string' && idToken.startsWith('mock_otp_')) {
          const norm = real.normalizePhoneNumber(idToken.slice('mock_otp_'.length));
          return { uid: `mock_${norm.national}`, e164: norm.e164, national: norm.national };
        }
        // Anything else is a test mistake, not a silent pass.
        throw new Error('Invalid Firebase phone token');
      },

      async verifyFirebaseGoogleToken(idToken: string) {
        if (googleUser) return googleUser;
        throw new Error('Invalid Google token');
      },
    },
  });
}
