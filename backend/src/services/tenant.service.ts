import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────

/** Same UPI shape used by the Android validator and the deposit flow. */
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** WhatsApp digits: optional country code, 10-15 digits, no + or spaces. */
export const WHATSAPP_REGEX = /^\d{10,15}$/;

export const MIN_DEPOSIT_FLOOR = 10;
export const MIN_DEPOSIT_CEILING = 10000;

// ─── VIEWS ───────────────────────────────────────────────────────────────

export interface TenantSettingsView {
  brandName: string;
  upiId: string;
  upiName: string;
  supportWhatsapp: string;
  minDeposit: number;
  allowPhoneAuth: boolean;
  allowGoogleAuth: boolean;
  allowEmailAuth: boolean;
}

export interface UpdateTenantSettingsInput {
  upiId?: string;
  upiName?: string;
  supportWhatsapp?: string;
  minDeposit?: number;
  allowPhoneAuth?: boolean;
  allowGoogleAuth?: boolean;
  allowEmailAuth?: boolean;
}

function toSettingsView(tenant: {
  brandName: string;
  upiId: string | null;
  upiName: string | null;
  supportWhatsapp: string | null;
  minDeposit: number;
  allowPhoneAuth?: boolean | null;
  allowGoogleAuth?: boolean | null;
  allowEmailAuth?: boolean | null;
}): TenantSettingsView {
  return {
    brandName: tenant.brandName,
    upiId: tenant.upiId ?? '',
    upiName: tenant.upiName ?? tenant.brandName,
    supportWhatsapp: tenant.supportWhatsapp ?? '',
    minDeposit: tenant.minDeposit ?? MIN_DEPOSIT_FLOOR,
    allowPhoneAuth: tenant.allowPhoneAuth ?? true,
    allowGoogleAuth: tenant.allowGoogleAuth ?? true,
    allowEmailAuth: tenant.allowEmailAuth ?? true,
  };
}

// ─── PUBLIC (any logged-in user): the runtime branding + payment config ──
//
// The Player app reads this on login/resume so the Add-Cash QR, payee name,
// minimum amount and WhatsApp support link follow the database — the client
// can change their UPI ID from the Admin app without shipping a new APK.

export async function getTenantSettings(tenantId: string): Promise<TenantSettingsView> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      brandName: true,
      upiId: true,
      upiName: true,
      supportWhatsapp: true,
      minDeposit: true,
      allowPhoneAuth: true,
      allowGoogleAuth: true,
      allowEmailAuth: true,
    },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  return toSettingsView(tenant);
}

// ─── OWNER ONLY: update settings at runtime ─────────────────────────────

export async function updateTenantSettings(
  tenantId: string,
  input: UpdateTenantSettingsInput,
): Promise<TenantSettingsView> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      isActive: true,
      allowPhoneAuth: true,
      allowGoogleAuth: true,
      allowEmailAuth: true,
    },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  if (!tenant.isActive) throw ApiError.forbidden('This tenant is deactivated');

  const data: {
    upiId?: string;
    upiName?: string;
    supportWhatsapp?: string | null;
    minDeposit?: number;
    allowPhoneAuth?: boolean;
    allowEmailAuth?: boolean;
    allowGoogleAuth?: boolean;
  } = {};

  if (input.upiId !== undefined) {
    const upiId = input.upiId.trim();
    if (upiId.length === 0) {
      throw ApiError.badRequest('UPI ID cannot be empty');
    }
    if (!UPI_ID_REGEX.test(upiId)) {
      throw ApiError.badRequest('UPI ID must look like name@bank (e.g. thunderesports@okaxis)');
    }
    data.upiId = upiId;
  }

  if (input.upiName !== undefined) {
    const upiName = input.upiName.trim();
    if (upiName.length < 2 || upiName.length > 60) {
      throw ApiError.badRequest('Payee name must be between 2 and 60 characters');
    }
    data.upiName = upiName;
  }

  if (input.supportWhatsapp !== undefined) {
    const raw = input.supportWhatsapp.trim().replace(/[\s+\-()]/g, '');
    if (raw.length === 0) {
      data.supportWhatsapp = null; // optional — clears the support row
    } else {
      if (!WHATSAPP_REGEX.test(raw)) {
        throw ApiError.badRequest('WhatsApp number must be 10-15 digits (with country code, e.g. 919999900001)');
      }
      data.supportWhatsapp = raw;
    }
  }

  if (input.minDeposit !== undefined) {
    const minDeposit = Math.round(Number(input.minDeposit));
    if (!Number.isFinite(minDeposit) || minDeposit < MIN_DEPOSIT_FLOOR || minDeposit > MIN_DEPOSIT_CEILING) {
      throw ApiError.badRequest(
        `Minimum deposit must be between ₹${MIN_DEPOSIT_FLOOR} and ₹${MIN_DEPOSIT_CEILING}`,
      );
    }
    data.minDeposit = minDeposit;
  }

  if (input.allowPhoneAuth !== undefined) {
    data.allowPhoneAuth = Boolean(input.allowPhoneAuth);
  }
  if (input.allowGoogleAuth !== undefined) {
    data.allowGoogleAuth = Boolean(input.allowGoogleAuth);
  }
  if (input.allowEmailAuth !== undefined) {
    data.allowEmailAuth = Boolean(input.allowEmailAuth);
  }

  // Ensure at least one authentication method remains enabled
  const finalPhoneAuth = data.allowPhoneAuth !== undefined ? data.allowPhoneAuth : tenant.allowPhoneAuth;
  const finalGoogleAuth = data.allowGoogleAuth !== undefined ? data.allowGoogleAuth : tenant.allowGoogleAuth;
  const finalEmailAuth = data.allowEmailAuth !== undefined ? data.allowEmailAuth : tenant.allowEmailAuth;

  if (!finalPhoneAuth && !finalGoogleAuth && !finalEmailAuth) {
    throw ApiError.badRequest('At least one authentication method must remain enabled.');
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('Nothing to update');
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      brandName: true,
      upiId: true,
      upiName: true,
      supportWhatsapp: true,
      minDeposit: true,
      allowPhoneAuth: true,
      allowGoogleAuth: true,
      allowEmailAuth: true,
    },
  });

  return toSettingsView(updated);
}

/** Minimum deposit enforced by the deposit flow (tenant-configurable). */
export async function resolveMinDeposit(tenantId: string): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { minDeposit: true },
  });
  return tenant?.minDeposit ?? MIN_DEPOSIT_FLOOR;
}
