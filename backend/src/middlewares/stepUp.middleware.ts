import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * ─── Step-up authentication ───────────────────────────────────────────────
 *
 * A stolen session cookie is a read-everything bug; it must not become a
 * move-the-money bug. The handful of actions below therefore demand a fresh
 * 6-digit code mailed to the admin's own inbox, even on a perfectly valid
 * session. The proof is a short-lived JWT sent in `X-Step-Up-Token`.
 *
 * Android/Bearer sessions are exempt: those tokens are already re-checked
 * against the DB and are not ambient (no browser, no CSRF, no cookie theft).
 */

export const STEP_UP_HEADER = 'x-step-up-token';
export const STEP_UP_PURPOSE = 'step-up';
export const STEP_UP_REQUIRED_CODE = 'STEP_UP_REQUIRED';

export interface StepUpPayload {
  userId: string;
  tenantId: string;
  sid?: string;
  purpose: string;
}

/** Signs the short-lived proof returned by /auth/admin/step-up/verify. */
export function signStepUpToken(user: { id: string; tenantId: string }, sessionId?: string): string {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      ...(sessionId ? { sid: sessionId } : {}),
      purpose: STEP_UP_PURPOSE,
    },
    env.JWT_SECRET,
    {
      expiresIn: `${env.ADMIN_STEP_UP_TTL_MINUTES}m`,
      issuer: 'freefire-tournament-api',
      audience: 'freefire-tournament-steps',
    },
  );
}

export function verifyStepUpToken(token: string): StepUpPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'freefire-tournament-api',
      audience: 'freefire-tournament-steps',
    }) as jwt.JwtPayload & Partial<StepUpPayload>;

    if (decoded.purpose !== STEP_UP_PURPOSE || !decoded.userId) return null;
    return {
      userId: decoded.userId,
      tenantId: String(decoded.tenantId ?? ''),
      sid: decoded.sid,
      purpose: decoded.purpose,
    };
  } catch {
    return null;
  }
}

/**
 * Guard for the money/settings routes. `action` is echoed to the console so
 * the modal can say "Confirm <action> with a sign-in code".
 */
export function requireStepUp(action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const user = req.user;
      if (!user) throw ApiError.unauthorized('Authentication required');

      // Bearer sessions (Android) are not ambient credentials.
      if (req.authVia !== 'cookie') {
        next();
        return;
      }

      const header = req.headers[STEP_UP_HEADER];
      const raw = Array.isArray(header) ? header[0] : header;
      if (!raw) {
        next(
          ApiError.forbidden('Confirm this action with a sign-in code', {
            code: STEP_UP_REQUIRED_CODE,
            action,
          }),
        );
        return;
      }

      const proof = verifyStepUpToken(raw);
      if (!proof || proof.userId !== user.userId || proof.tenantId !== user.tenantId) {
        next(
          ApiError.forbidden('Your confirmation expired — enter a fresh code', {
            code: STEP_UP_REQUIRED_CODE,
            action,
          }),
        );
        return;
      }

      // Bind the proof to the browser that asked for it.
      if (proof.sid && req.sessionId && proof.sid !== req.sessionId) {
        next(
          ApiError.forbidden('Your confirmation expired — enter a fresh code', {
            code: STEP_UP_REQUIRED_CODE,
            action,
          }),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
