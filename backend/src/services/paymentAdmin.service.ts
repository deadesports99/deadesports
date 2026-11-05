import { prisma } from '../config/prisma.js';
import { paymentConfig } from '../config/payment.js';

/**
 * Admin-facing read model for ONLINE payments (Razorpay / mock top-ups).
 *
 * Why this exists: until now the wallet console only showed UTR-based
 * deposits. Online orders settled themselves in the background, so the admin
 * had no single place to see "kitna online paisa aaya, kaunsa order atka hai".
 * This service feeds the admin "Online" tab:
 *   GET  /api/v1/admin/wallet/payments          -> list + money summary
 *   POST /api/v1/admin/wallet/payments/:id/sync -> reconcile one order
 */

export type PaymentOrderFilter = 'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED' | 'EXPIRED';

const FILTER_STATUSES: Record<PaymentOrderFilter, string[] | null> = {
  ALL: null,
  CAPTURED: ['CAPTURED'],
  // Orders that still need attention: created/pending, gateways say "authorized"
  PENDING: ['CREATED', 'PENDING'],
  FAILED: ['FAILED'],
  EXPIRED: ['EXPIRED'],
};

export interface AdminPaymentOrderRow {
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
  player: {
    id: string;
    name: string | null;
    inGameName: string | null;
    inGameUid: string | null;
    phoneNumber: string;
  };
}

export interface AdminPaymentsSummary {
  /** Captured today (server day, IST-friendly label in the UI). */
  collectedTodayPaise: number;
  collectedTodayRupees: number;
  /** Captured all-time for this tenant. */
  collectedTotalPaise: number;
  collectedTotalRupees: number;
  capturedCount: number;
  pendingCount: number;
  failedCount: number;
  /** True when the tenant is on the mock gateway — money is not real. */
  demoMode: boolean;
}

export interface ListAdminPaymentsResult {
  payments: AdminPaymentOrderRow[];
  summary: AdminPaymentsSummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function listAdminPayments(
  tenantId: string,
  options: { status?: PaymentOrderFilter; page?: number; limit?: number } = {},
): Promise<ListAdminPaymentsResult> {
  const status = options.status ?? 'ALL';
  if (!(status in FILTER_STATUSES)) {
    throw Object.assign(new Error(`Unknown status filter: ${status}`), { statusCode: 400 });
  }

  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.min(100, Math.max(5, Math.floor(options.limit ?? 30)));

  const where = {
    tenantId,
    ...(FILTER_STATUSES[status] ? { status: { in: FILTER_STATUSES[status] as never } } : {}),
  };

  const [total, rows, capturedAll, capturedToday, capturedCount, pendingCount, failedCount] =
    await Promise.all([
      prisma.paymentOrder.count({ where }),
      prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentOrder.aggregate({
        where: { tenantId, status: 'CAPTURED' },
        _sum: { amountPaise: true },
      }),
      prisma.paymentOrder.aggregate({
        where: { tenantId, status: 'CAPTURED', capturedAt: { gte: startOfToday() } },
        _sum: { amountPaise: true },
      }),
      prisma.paymentOrder.count({ where: { tenantId, status: 'CAPTURED' } }),
      prisma.paymentOrder.count({ where: { tenantId, status: { in: ['CREATED', 'PENDING'] } } }),
      prisma.paymentOrder.count({ where: { tenantId, status: 'FAILED' } }),
    ]);

  // One batched player lookup — no N+1 queries for the list.
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const players = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          inGameName: true,
          inGameUid: true,
          phoneNumber: true,
        },
      })
    : [];
  const playerById = new Map(players.map((p) => [p.id, p]));

  const totalPaise = capturedAll._sum.amountPaise ?? 0;
  const todayPaise = capturedToday._sum.amountPaise ?? 0;

  return {
    payments: rows.map((r) => {
      const player = playerById.get(r.userId);
      return {
        id: r.id,
        amountPaise: r.amountPaise,
        amountRupees: r.amountPaise / 100,
        currency: r.currency,
        provider: r.provider,
        status: r.status,
        providerOrderId: r.providerOrderId,
        providerPaymentId: r.providerPaymentId,
        failureReason: r.failureReason,
        createdAt: r.createdAt,
        capturedAt: r.capturedAt,
        player: {
          id: r.userId,
          name: player?.name ?? null,
          inGameName: player?.inGameName ?? null,
          inGameUid: player?.inGameUid ?? null,
          phoneNumber: player?.phoneNumber ?? '',
        },
      };
    }),
    summary: {
      collectedTodayPaise: todayPaise,
      collectedTodayRupees: todayPaise / 100,
      collectedTotalPaise: totalPaise,
      collectedTotalRupees: totalPaise / 100,
      capturedCount,
      pendingCount,
      failedCount,
      demoMode: paymentConfig.provider === 'mock',
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
