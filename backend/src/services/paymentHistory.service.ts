import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { paymentConfig } from '../config/payment.js';

/**
 * Player-facing read model for online top-ups.
 *
 * Why: a player who paid ₹500 and saw a spinner has no way to prove what
 * happened. Support used to answer "did my money come?" by hand. This feeds the
 * "Recent top-ups" list in the Wallet screen:
 *   GET /api/v1/payments/my?status=ALL&page=1&limit=10
 *
 * Rules:
 *  - only the caller's OWN orders (tenant-scoped), never another player's,
 *  - newest first, bounded page size (a huge limit cannot dump the table),
 *  - read-only: this endpoint NEVER settles, credits or reconciles anything.
 */

export type PlayerPaymentFilter = 'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED' | 'EXPIRED';

const FILTER_STATUSES: Record<PlayerPaymentFilter, string[] | null> = {
  ALL: null,
  CAPTURED: ['CAPTURED'],
  // Still on the way: created locally or authorised at the gateway.
  PENDING: ['CREATED', 'PENDING', 'AUTHORIZED'],
  FAILED: ['FAILED'],
  EXPIRED: ['EXPIRED'],
};

export interface PlayerPaymentRow {
  id: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  provider: string;
  status: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  expiresAt: Date | null;
}

export interface ListMyPaymentsResult {
  items: PlayerPaymentRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  /** True when the tenant is on the mock gateway — the money is not real. */
  demoMode: boolean;
}

function toRow(order: {
  id: string;
  amountPaise: number;
  currency: string;
  provider: string;
  status: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  expiresAt: Date;
}): PlayerPaymentRow {
  return {
    id: order.id,
    amountPaise: order.amountPaise,
    // Display helper only — the money path stays in integer paise.
    amountRupees: order.amountPaise / 100,
    currency: order.currency,
    provider: order.provider,
    status: order.status,
    providerOrderId: order.providerOrderId,
    providerPaymentId: order.providerPaymentId,
    failureReason: order.failureReason,
    createdAt: order.createdAt,
    capturedAt: order.capturedAt,
    expiresAt: order.expiresAt,
  };
}

export async function listMyPayments(
  userId: string,
  tenantId: string,
  options: { status?: string; page?: number; limit?: number } = {},
): Promise<ListMyPaymentsResult> {
  const status = String(options.status ?? 'ALL').toUpperCase();
  if (!(status in FILTER_STATUSES)) {
    throw new ApiError(400, `Unknown status filter: ${status}`);
  }

  const page = Math.max(1, Math.floor(Number(options.page ?? 1)) || 1);
  const limit = Math.min(50, Math.max(1, Math.floor(Number(options.limit ?? 10)) || 10));

  const where = {
    userId,
    tenantId,
    ...(FILTER_STATUSES[status as PlayerPaymentFilter]
      ? { status: { in: FILTER_STATUSES[status as PlayerPaymentFilter] as never } }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.paymentOrder.count({ where }),
    prisma.paymentOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: orders.map(toRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    demoMode: paymentConfig.provider === 'mock',
  };
}
