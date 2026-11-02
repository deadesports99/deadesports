import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Request validation schemas (zod v4) ────────────────────────────────

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be 10-15 digits (E.164 format allowed)');

const registerPlayerSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  phoneNumber: phoneSchema,
  inGameName: z
    .string()
    .trim()
    .min(2, 'In-game name must be at least 2 characters')
    .max(30, 'In-game name max 30 characters'),
  inGameUid: z.string().trim().regex(/^\d{6,12}$/, 'Free Fire UID must be 6-12 digits'),
  deviceId: z.string().trim().min(1).max(255).optional(),
});

const loginSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  phoneNumber: phoneSchema,
});

const permissionsSchema = z
  .object({
    canCreateMatch: z.boolean().optional(),
    canUpdateRoomId: z.boolean().optional(),
    canDistributePrize: z.boolean().optional(),
    canManageWallet: z.boolean().optional(),
  })
  .strict(); // Reject unknown permission keys

const createStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Invalid email address').max(254),
  phoneNumber: phoneSchema,
  permissions: permissionsSchema.optional(),
});

const fcmTokenSchema = z.object({
  token: z.string().trim().min(20, 'Invalid FCM token').max(512),
});

// ─── Handlers ───────────────────────────────────────────────────────────

export async function registerPlayer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = registerPlayerSchema.parse(req.body);
    const result = await authService.registerPlayer(body);
    sendResponse(res, 201, 'Player registered successfully', result);
  } catch (err) {
    next(err);
  }
}

export async function loginWithPhone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.loginWithPhone(body);
    sendResponse(res, 200, 'Login successful', result);
  } catch (err) {
    next(err);
  }
}

export async function createStaffMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new Error('Authenticated user missing'); // defensive — guarded by middleware
    }
    const body = createStaffSchema.parse(req.body);
    const result = await authService.createStaffMember(
      {
        id: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
      },
      body,
    );
    sendResponse(res, 201, 'Staff member created successfully', result);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new Error('Authenticated user missing'); // defensive — guarded by middleware
    }
    const profile = await authService.getUserProfile(req.user.userId);
    sendResponse(res, 200, 'Profile fetched', profile);
  } catch (err) {
    next(err);
  }
}

export async function registerFcmToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const { token } = fcmTokenSchema.parse(req.body);
    const result = await authService.saveFcmToken(req.user.userId, token);
    sendResponse(res, 200, 'Push token registered', result);
  } catch (err) {
    next(err);
  }
}