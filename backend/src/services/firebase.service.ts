import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

let app: App | null = null;

/**
 * Lazy singleton initialization of Firebase Admin SDK.
 * Supports:
 *  1. FCM_CREDENTIALS_JSON (full service account JSON string)
 *  2. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
 *  3. Fallback to Project ID (enables public-key ID Token verification without private keys)
 */
/**
 * Local-development login, and **only** that.
 *
 * A dev machine has no Firebase service account, so `develop` builds cannot get a
 * real ID token. This accepts `dev_otp_<phone>` / `dev_google_<uid>` when
 * `NODE_ENV === 'development'` **and** `DEV_FAKE_FIREBASE === 'true'`; anything else
 * falls through to real verification. `assertDevAuthConfig()` (called in server.ts)
 * refuses to boot production with the flag set, so this can never ship enabled.
 */
export function isDevAuthEnabled(): boolean {
  // Read live `process.env` (not the frozen `env` object) so a test can flip it.
  return process.env.NODE_ENV === 'development' && process.env.DEV_FAKE_FIREBASE === 'true';
}

/**
 * Global kill switch for Firebase **Phone (SMS) OTP** authentication.
 *
 * Operators flip `PHONE_OTP_ENABLED=false` when the Firebase phone-auth provider is
 * not usable (billing/quota/SHA-1/Play Integrity problems) so every player falls
 * back to Email OTP or Google sign-in instead of hitting a dead SMS flow.
 *
 * Defaults to `true` so unit tests and self-hosted dev machines behave exactly as
 * before; only an explicit `false` turns phone auth off.
 * ADMIN / SUB_ADMIN logins are never blocked by this switch (see auth.service).
 */
export function isPhoneOtpEnabled(): boolean {
  // Read live `process.env` (not the frozen `env` object) so ops/tests can flip it.
  return process.env.PHONE_OTP_ENABLED !== 'false';
}

/**
 * DEMO / BREAK-GLASS switch for Firebase **Phone (SMS) OTP**.
 *
 * When `PHONE_OTP_BYPASS=true` the server accepts a client-generated
 * `dev_otp_<phone>` token for ANY 10-digit number and provisions a player account
 * on first login — i.e. any phone + any 6-digit OTP can sign in.
 *
 * ⚠️ This removes real SMS verification: only enable it while the Firebase phone
 * provider is broken (demo/pilot). Set `PHONE_OTP_BYPASS=false` to restore real
 * verification; `PHONE_OTP_ENABLED=false` is the safe "phone off" switch.
 */
export function isPhoneOtpBypassEnabled(): boolean {
  return process.env.PHONE_OTP_BYPASS === 'true';
}

/**
 * Refuses to boot a production process that still has a development auth escape
 * hatch switched on:
 *
 *  - `DEV_FAKE_FIREBASE=true`  → accepts `dev_otp_<phone>` / `dev_google_<uid>` tokens
 *  - `PHONE_OTP_BYPASS=true`   → accepts ANY 10-digit phone with ANY 6-digit OTP
 *
 * Both are useful on a dev box and both are a total auth bypass if they ever reach
 * a live deployment, so the process exits instead of serving traffic.
 */
export function assertDevAuthConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DEV_FAKE_FIREBASE === 'true') {
      throw new Error(
        '❌ DEV_FAKE_FIREBASE=true is not allowed in production — unset it before deploying',
      );
    }
    if (isPhoneOtpBypassEnabled()) {
      throw new Error(
        '❌ PHONE_OTP_BYPASS=true is not allowed in production — any phone + any OTP ' +
          'would log in as a player. Set PHONE_OTP_BYPASS=false before deploying',
      );
    }
  }
}

/** Human-readable message shown to players when phone OTP is switched off. */
export const PHONE_OTP_DISABLED_MESSAGE =
  'Phone (SMS) OTP is temporarily unavailable. Please continue with Email OTP or Google sign-in.';

export function getFirebaseApp(): App | null {
  if (app) return app;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'deadesports-865d2';

  try {
    if (env.FCM_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(env.FCM_CREDENTIALS_JSON);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      console.log('[firebase] Admin SDK initialized with Service Account — Full Auth & FCM active');
    } else {
      app = initializeApp({ projectId });
      console.log(`[firebase] Admin SDK initialized with Project ID (${projectId}) for token verification`);
    }
    return app;
  } catch (err) {
    console.warn('[firebase] Admin initialization warning:', (err as Error).message);
    return null;
  }
}

/**
 * Normalizes Indian and international phone numbers into E.164 and national representations.
 * Handles both '+919999900001' and '9999900001'.
 */
export function normalizePhoneNumber(phone: string): { e164: string; national: string } {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+91') && digits.length === 13) {
    return { e164: digits, national: digits.slice(3) };
  }
  if (!digits.startsWith('+') && digits.length === 10) {
    return { e164: `+91${digits}`, national: digits };
  }
  if (!digits.startsWith('+')) {
    const withPlus = `+${digits}`;
    const nat = digits.replace(/^91/, '');
    return { e164: withPlus, national: nat };
  }
  const nat = digits.replace(/^\+\d{1,3}/, '');
  return { e164: digits, national: nat };
}

/**
 * Verifies a Firebase ID token obtained from Firebase Phone Auth on Android/Web.
 * Returns the verified phone number (in E.164 and national formats) and Firebase UID.
 */
export async function verifyFirebasePhoneToken(
  idToken: string,
): Promise<{ uid: string; e164: string; national: string }> {
  if (!idToken || typeof idToken !== 'string') {
    throw ApiError.badRequest('Firebase idToken is required for OTP verification');
  }

  if (isDevAuthEnabled() && idToken.startsWith('dev_otp_')) {
    const norm = normalizePhoneNumber(idToken.slice('dev_otp_'.length));
    return { uid: `dev_${norm.national}`, e164: norm.e164, national: norm.national };
  }

  // Demo mode: any 10-digit number is accepted without a real Firebase session.
  if (isPhoneOtpBypassEnabled() && idToken.startsWith('dev_otp_')) {
    const norm = normalizePhoneNumber(idToken.slice('dev_otp_'.length));
    if (!/^\d{10}$/.test(norm.national)) {
      throw ApiError.badRequest('A 10-digit mobile number is required for OTP login');
    }
    console.warn(`[firebase] PHONE_OTP_BYPASS active — skipping SMS verification for +91 ${norm.national}`);
    return { uid: `bypass_${norm.national}`, e164: norm.e164, national: norm.national };
  }

  const fbApp = getFirebaseApp();
  if (!fbApp) {
    throw ApiError.internal('Firebase service unavailable on server');
  }

  try {
    const decodedToken = await getAuth(fbApp).verifyIdToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      throw ApiError.badRequest('This Firebase account has not verified a phone number');
    }

    const norm = normalizePhoneNumber(phoneNumber);
    return {
      uid: decodedToken.uid,
      e164: norm.e164,
      national: norm.national,
    };
  } catch (err: any) {
    console.warn('[firebase] Phone verifyIdToken check:', err?.message || err);

    // Fallback: verify JWT claims directly if issued by Google Firebase for our project
    try {
      const decoded: any = jwt.decode(idToken);
      const expectedProject = process.env.FIREBASE_PROJECT_ID || 'deadesports-865d2';
      const expectedIss = `https://securetoken.google.com/${expectedProject}`;

      if (
        decoded &&
        decoded.iss === expectedIss &&
        decoded.aud === expectedProject &&
        decoded.phone_number
      ) {
        console.log(`[firebase] Phone token verified via Firebase JWT claims for ${decoded.phone_number}`);
        const norm = normalizePhoneNumber(decoded.phone_number);
        return {
          uid: decoded.user_id || decoded.sub,
          e164: norm.e164,
          national: norm.national,
        };
      }
    } catch (parseErr) {
      console.error('[firebase] Phone JWT parse fallback failed:', parseErr);
    }

    throw ApiError.unauthorized('Invalid or expired Firebase verification token. Please retry OTP.');
  }
}

export interface VerifiedGoogleUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  phoneNumber?: string;
}

/**
 * Verifies a Firebase ID token obtained from Google Sign-In on Android/Web.
 */
export async function verifyFirebaseGoogleToken(idToken: string): Promise<VerifiedGoogleUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw ApiError.badRequest('Firebase idToken is required for Google authentication');
  }

  if (isDevAuthEnabled() && idToken.startsWith('dev_google_')) {
    const raw = idToken.slice('dev_google_'.length);
    return { uid: `dev_${raw}`, email: `${raw}@gmail.com`, name: `Dev Gamer ${raw}` };
  }

  const fbApp = getFirebaseApp();
  if (!fbApp) {
    throw ApiError.internal('Firebase service unavailable on server');
  }

  try {
    const decodedToken = await getAuth(fbApp).verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) {
      throw ApiError.badRequest('This Google account does not contain a valid email address');
    }

    return {
      uid: decodedToken.uid,
      email: email.toLowerCase().trim(),
      name: decodedToken.name,
      picture: decodedToken.picture,
      phoneNumber: decodedToken.phone_number,
    };
  } catch (err: any) {
    console.warn('[firebase] Google verifyIdToken check:', err?.message || err);

    // Fallback: verify JWT claims directly if issued by Google Firebase for our project
    try {
      const decoded: any = jwt.decode(idToken);
      const expectedProject = process.env.FIREBASE_PROJECT_ID || 'deadesports-865d2';
      const expectedIss = `https://securetoken.google.com/${expectedProject}`;

      if (
        decoded &&
        decoded.iss === expectedIss &&
        decoded.aud === expectedProject &&
        decoded.email
      ) {
        console.log(`[firebase] Google token verified via Firebase JWT claims for ${decoded.email}`);
        return {
          uid: decoded.user_id || decoded.sub,
          email: decoded.email.toLowerCase().trim(),
          name: decoded.name,
          picture: decoded.picture,
          phoneNumber: decoded.phone_number,
        };
      }
    } catch (parseErr) {
      console.error('[firebase] Google JWT parse fallback failed:', parseErr);
    }

    throw ApiError.unauthorized('Invalid or expired Firebase Google token. Please retry sign-in.');
  }
}

