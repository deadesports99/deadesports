import type { CookieOptions, Request } from 'express';
import { env } from '../config/env.js';

/**
 * Tiny cookie helpers — the project deliberately avoids an extra dependency
 * (cookie-parser) for a single cookie. Only `admin_session` is read.
 */

export const ADMIN_SESSION_COOKIE = 'admin_session';

/** Parses a `Cookie:` header into a plain object (first value wins). */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Reads one cookie from the request (undefined when absent). */
export function readCookie(req: Request, name: string): string | undefined {
  return parseCookieHeader(req.headers.cookie)[name];
}

/**
 * Cookie attributes shared by login, rolling renewal and logout.
 *
 * httpOnly + SameSite=Strict + host-only (no Domain) is what keeps the session
 * out of JS and off cross-site requests. `maxAge` is the IDLE window — every
 * rolling renewal re-issues the cookie with a fresh one.
 */
export function adminSessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}
