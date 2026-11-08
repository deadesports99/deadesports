import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { ADMIN_SESSION_COOKIE } from '../utils/cookies.js';
import { ApiError } from '../utils/ApiError.js';
import * as adminAuthService from '../services/adminAuth.service.js';

/**
 * Admin web auth controllers.
 * Mounted at /api/v1/auth/admin — separate from the player phone/OTP routes.
 */

const requestOtpSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address'),
    /** Required for sub-admins; omitted by the owner. */
    accessKey: z.string().trim().min(10).max(64).optional(),
    tenantId: z.string().trim().min(1).optional(),
  })
  .strict();

const verifyOtpSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address'),
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    accessKey: z.string().trim().min(10).max(64).optional(),
  })
  .strict();

/** Shared cookie options — httpOnly, host-only, Strict. */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

/** Step 1 — email (+ staff key) → OTP sent to the owner inbox. */
export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = requestOtpSchema.parse(req.body);
    const result = await adminAuthService.requestAdminOtp({
      email: body.email,
      accessKey: body.accessKey,
      tenantId: body.tenantId,
      ip: req.ip,
    });

    // `debugOtp` only exists outside production (dev/testing convenience).
    sendResponse(res, 200, result.message, {
      expiresInSeconds: result.expiresInSeconds,
      requiresKey: result.requiresKey,
      debugOtp: result.debugOtp,
    });
  } catch (error) {
    next(error);
  }
}

/** Step 2 — OTP (+ staff key) → httpOnly cookie session. */
export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const result = await adminAuthService.verifyAdminOtp({
      email: body.email,
      otp: body.otp,
      accessKey: body.accessKey,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(ADMIN_SESSION_COOKIE, result.token, sessionCookieOptions());
    sendResponse(res, 200, 'Signed in', { user: result.user });
  } catch (error) {
    next(error);
  }
}

/** Clears the cookie and audits the logout. */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    await adminAuthService.recordAdminLogout(
      { userId: req.user.userId, tenantId: req.user.tenantId, role: req.user.role },
      { ip: req.ip },
    );

    res.clearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    sendResponse(res, 200, 'Signed out');
  } catch (error) {
    next(error);
  }
}
