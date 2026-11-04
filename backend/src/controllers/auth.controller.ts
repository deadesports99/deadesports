import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { sendResponse } from '../utils/ApiResponse.js';

// ─── Request validation schemas (zod v4) ────────────────────────────────

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be 10-15 digits (E.164 format allowed)');

const registerPlayerSchema = z
  .object({
    tenantId: z.string().min(1, 'tenantId is required'),
    phoneNumber: phoneSchema.optional(),
    idToken: z.string().min(10, 'Firebase idToken must be valid').optional(),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    inGameName: z
      .string()
      .trim()
      .min(2, 'In-game name must be at least 2 characters')
      .max(30, 'In-game name max 30 characters')
      .optional(),
    inGameUid: z
      .string()
      .trim()
      .regex(/^\d{6,12}$/, 'Free Fire UID must be 6-12 digits')
      .optional(),
    deviceId: z.string().trim().min(1).max(255).optional(),
  })
  .refine((data) => Boolean(data.phoneNumber || data.idToken), {
    message: 'Either phoneNumber or Firebase idToken is required',
  });

const loginSchema = z
  .object({
    tenantId: z.string().min(1, 'tenantId is required'),
    phoneNumber: phoneSchema.optional(),
    idToken: z.string().min(10, 'Firebase idToken must be valid').optional(),
  })
  .refine((data) => Boolean(data.phoneNumber || data.idToken), {
    message: 'Either phoneNumber or Firebase idToken is required',
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

const updateStaffSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    email: z.string().trim().email('Invalid email address').max(254).optional(),
    permissions: permissionsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

const staffIdSchema = z.string().trim().min(1, 'staffId is required').max(64);

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

const googleAuthSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  idToken: z.string().min(10, 'Firebase idToken must be valid'),
  deviceId: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = googleAuthSchema.parse(req.body);
    const result = await authService.googleLoginOrRegister(body);
    sendResponse(res, 200, 'Authenticated successfully with Google', result);
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

// ─── Staff management (ADMIN only) ──────────────────────────────────────

export async function listStaffMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const result = await authService.listStaffMembers({
      id: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
    });
    sendResponse(res, 200, 'Staff members fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function updateStaffMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const staffId = staffIdSchema.parse(String(req.params.id));
    const body = updateStaffSchema.parse(req.body);
    const staff = await authService.updateStaffMember(
      { id: req.user.userId, tenantId: req.user.tenantId, role: req.user.role },
      staffId,
      body,
    );
    sendResponse(res, 200, 'Staff member updated', { staff });
  } catch (err) {
    next(err);
  }
}

export async function removeStaffMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');
    const staffId = staffIdSchema.parse(String(req.params.id));
    const staff = await authService.removeStaffMember(
      { id: req.user.userId, tenantId: req.user.tenantId, role: req.user.role },
      staffId,
    );
    sendResponse(res, 200, 'Staff member deactivated', { staff });
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
