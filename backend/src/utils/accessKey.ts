import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * ─── Admin web credentials ────────────────────────────────────────────────
 *
 * Sub-admins do not get their own email login: they enter the OWNER's email,
 * a 24-character permission key and the OTP the owner received. The key is the
 * identity (which sub-admin) and is used exactly like an API key:
 *
 *   generate  ->  plain key shown ONCE to the owner
 *                 only HMAC(hash) stored in StaffAccessKey.keyHash
 *   login     ->  hash the typed key, constant-time compare
 *   revoke    ->  DB row gets revokedAt, every future login fails
 *
 * Alphabet = 62 chars, length = 24 -> log2(62) * 24 ≈ 143 bits of entropy.
 * crypto.randomInt keeps every character uniformly distributed (no modulo bias).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const ACCESS_KEY_LENGTH = 24;
/** Shown to the owner as K7pQ2x-9mR4tL-8vN3sW-5cB6 (dashes are cosmetic only). */
export const ACCESS_KEY_GROUP_SIZE = 6;

function randomChar(): string {
  // crypto.randomInt upper bound is exclusive — uniform across all 62 chars.
  return ALPHABET[crypto.randomInt(0, ALPHABET.length)];
}

/** Raw 24-character key (no dashes) — this is what gets hashed. */
export function generateRawAccessKey(): string {
  let key = '';
  for (let index = 0; index < ACCESS_KEY_LENGTH; index += 1) key += randomChar();
  return key;
}

/** Adds dashes every 6 characters so the owner can read/share it easily. */
export function formatAccessKey(rawKey: string): string {
  const normalized = normalizeAccessKey(rawKey);
  return normalized.replace(
    new RegExp(`(.{${ACCESS_KEY_GROUP_SIZE}})(?=.)`, 'g'),
    '$1-',
  );
}

/** Strips dashes/spaces and everything that is not A-Z / a-z / 0-9. */
export function normalizeAccessKey(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '');
}

/** True when the input has exactly 24 alphanumeric characters. */
export function isWellFormedAccessKey(input: string): boolean {
  return normalizeAccessKey(input).length === ACCESS_KEY_LENGTH;
}

function hmac(value: string): string {
  return crypto.createHmac('sha256', env.ACCESS_KEY_PEPPER).update(value).digest('hex');
}

/** HMAC-SHA256 of the normalized key. Only this value is stored in the DB. */
export function hashAccessKey(accessKey: string): string {
  return hmac(normalizeAccessKey(accessKey));
}

/** Last 4 characters for the staff list ("...5cB6"). */
export function accessKeyHint(accessKey: string): string {
  return normalizeAccessKey(accessKey).slice(-4);
}

/**
 * Constant-time comparison of a typed key against a stored hash.
 * Buffers are always 64 hex bytes, so timingSafeEqual never throws.
 */
export function verifyAccessKey(accessKey: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashAccessKey(accessKey), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

// ─── Email OTP helpers ────────────────────────────────────────────────────

/** Generates a 6-digit numeric code with the CSPRNG (never Math.random). */
export function generateOtpCode(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

/** HMAC of the 6-digit code — plain OTPs are never stored. */
export function hashOtp(code: string): string {
  return hmac(code.trim());
}

/** Constant-time OTP comparison against the stored hash. */
export function verifyOtpHash(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}
