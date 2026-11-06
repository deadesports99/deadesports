import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { withSerializableRetry } from '../utils/transaction.js';
import { paymentGateway } from './paymentGateway.service.js';

/**
 * THE MONEY PATH — credit a captured online payment into the player wallet.
 *
 * Guarantees:
 *  1. Idempotent. The status flip is a conditional `updateMany` inside a
 *     Serializable transaction, so only ONE caller can move an order to
 *     CAPTURED. A second call (client retry, webhook + verify racing, double
 *     tap on the demo page) is a no-op and never double-credits.
 *  2. Atomic. Status flip + balance increment + ledger row commit together.
 *  3. Auditable. Every credit writes a WalletLedger row
 *     (CREDIT / ADD_MONEY / DEPOSIT) with `referenceId` = PaymentOrder id.
 *
 * There is no `Wallet` table in this schema — balances live on
 * `User.depositBalance` / `User.winningBalance`. Do not introduce one here.
 */

export interface SettleCapturedPaymentInput {
  /** Local PaymentOrder id (NOT the provider order id). */
  orderId: string;
  /** Provider payment id (`pay_*`). */
  providerPaymentId: string;
  /** Checkout signature, stored for audit when available. */
  signature?: string;
}

export interface SettleCapturedPaymentResult {
  orderId: string;
  /** True when the order was already CAPTURED before this call. */
  alreadySettled: boolean;
  /** Wallet deposit balance after settlement (₹, 2dp). */
  balanceAfter: number;
  /** Paise credited by THIS call (0 when already settled). */
  creditedPaise: number;
}

export async function settleCapturedPayment(
  input: SettleCapturedPaymentInput,
): Promise<SettleCapturedPaymentResult> {
  const { orderId, providerPaymentId, signature } = input;

  if (!orderId || !providerPaymentId) {
    throw ApiError.badRequest('orderId and providerPaymentId are required to settle');
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
        if (!order) throw ApiError.notFound('Payment order not found');

        // Fast path: already settled — report the current balance, credit nothing.
        if (order.status === 'CAPTURED') {
          const user = await tx.user.findUnique({
            where: { id: order.userId },
            select: { depositBalance: true },
          });
          return {
            orderId: order.id,
            alreadySettled: true,
            balanceAfter: Number(user?.depositBalance ?? 0),
            creditedPaise: 0,
          } satisfies SettleCapturedPaymentResult;
        }

        // Claim the order. `status: { not: 'CAPTURED' }` also lets a payment
        // that succeeded after our local EXPIRED/FAILED mark still be credited
        // (money in must never be lost because of a local sweep).
        const claimed = await tx.paymentOrder.updateMany({
          where: { id: order.id, status: { not: 'CAPTURED' } },
          data: {
            status: 'CAPTURED',
            capturedAt: new Date(),
            providerPaymentId,
            failureReason: null,
            ...(signature ? { signature } : {}),
          },
        });

        if (claimed.count !== 1) {
          // Lost the race to another settlement call — treat as success.
          const user = await tx.user.findUnique({
            where: { id: order.userId },
            select: { depositBalance: true },
          });
          return {
            orderId: order.id,
            alreadySettled: true,
            balanceAfter: Number(user?.depositBalance ?? 0),
            creditedPaise: 0,
          } satisfies SettleCapturedPaymentResult;
        }

        // Paise -> rupees as an exact Decimal (never a float).
        const amount = new Prisma.Decimal(order.amountPaise).div(100);

        const creditedUser = await tx.user.update({
          where: { id: order.userId },
          data: { depositBalance: { increment: amount } },
          select: { depositBalance: true },
        });

        await tx.walletLedger.create({
          data: {
            tenantId: order.tenantId,
            userId: order.userId,
            amount,
            balanceType: 'DEPOSIT',
            type: 'CREDIT',
            category: 'ADD_MONEY',
            balanceAfter: creditedUser.depositBalance,
            referenceId: order.id,
            notes: `Online top-up via ${order.provider} (${providerPaymentId})`,
          },
        });

        return {
          orderId: order.id,
          alreadySettled: false,
          balanceAfter: Number(creditedUser.depositBalance),
          creditedPaise: order.amountPaise,
        } satisfies SettleCapturedPaymentResult;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 20_000,
      },
    ),
  );
}

/**
 * Expire stale CREATED/PENDING orders. Called by the sweep in `server.ts`.
 * Returns how many rows were expired.
 */
export async function expireStalePaymentOrders(): Promise<number> {
  const result = await prisma.paymentOrder.updateMany({
    where: {
      status: { in: ['CREATED', 'PENDING'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED', failureReason: 'Checkout window expired' },
  });
  return result.count;
}

/**
 * Reconcile a payment order against the gateway (admin "Check status" and the
 * player's foreground sync both use this).
 *
 * Safe to call repeatedly: settlement itself is idempotent, so calling this on
 * a CAPTURED order or racing with a webhook never double-credits.
 */
export interface ReconcilePaymentOrderInput {
  tenantId: string;
  /** Local PaymentOrder id. */
  orderId: string;
  /** Overrides the stored provider payment id when the client just saw one. */
  paymentId?: string;
}

export interface ReconcilePaymentOrderResult {
  orderId: string;
  /** Local status after reconciliation. */
  status: string;
  /** Gateway status when it was queried (`captured`, `authorized`, ...). */
  gatewayStatus?: string;
  alreadySettled: boolean;
  balanceAfter?: number;
  creditedPaise?: number;
}

export async function reconcilePaymentOrder(
  input: ReconcilePaymentOrderInput,
): Promise<ReconcilePaymentOrderResult> {
  const { tenantId, orderId, paymentId } = input;

  const order = await prisma.paymentOrder.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw ApiError.notFound('Payment order not found');

  if (order.status === 'CAPTURED') {
    return { orderId: order.id, status: order.status, alreadySettled: true };
  }

  const gatewayPaymentId = paymentId ?? order.providerPaymentId ?? '';
  if (!gatewayPaymentId) {
    throw ApiError.conflict('No gateway payment recorded for this order yet');
  }

  const remote = await paymentGateway.fetchPayment(gatewayPaymentId);
  if (!remote) {
    // Mock mode: nothing remote to ask.
    return { orderId: order.id, status: order.status, alreadySettled: false };
  }

  if (remote.orderId !== order.providerOrderId) {
    throw ApiError.conflict('Payment does not belong to this order');
  }

  if (remote.status !== 'captured') {
    return {
      orderId: order.id,
      status: order.status,
      gatewayStatus: remote.status,
      alreadySettled: false,
    };
  }

  if (remote.amountPaise !== order.amountPaise) {
    throw ApiError.conflict('Paid amount does not match the order amount');
  }

  const settled = await settleCapturedPayment({
    orderId: order.id,
    providerPaymentId: remote.id,
  });

  return {
    orderId: order.id,
    status: 'CAPTURED',
    gatewayStatus: remote.status,
    alreadySettled: settled.alreadySettled,
    balanceAfter: settled.balanceAfter,
    creditedPaise: settled.creditedPaise,
  };
}

/**
 * Reconcile sweep: find orders that are still unpaid AFTER the player's
 * checkout window had a chance to finish, ask the gateway what really happened
 * and settle anything it captured. This is the safety net for a webhook that
 * never arrived (proxy, cold start, misconfigured URL) — without it the money
 * sits in PENDING until a human taps Sync.
 *
 * Deliberately narrow:
 *  - only CREATED/PENDING (never touches a settled or expired order); a gateway-side
 *    `authorized` payment still lives locally as PENDING, so it is covered,
 *  - only orders older than `olderThanMs` (a checkout in progress is not stale),
 *  - only orders whose checkout window is still open (expiry owns the rest),
 *  - only orders the gateway knows a payment id for,
 *  - mock mode is a no-op (nothing remote to ask).
 *
 * Settlement is idempotent, so racing the webhook or another sweep is safe.
 */
export interface ReconcileSweepResult {
  scanned: number;
  settled: number;
  stillPending: number;
  failed: number;
  /** True when the gateway cannot be queried (mock provider). */
  skipped: boolean;
}

export async function reconcileStalePaymentOrders(
  options: { olderThanMs?: number; limit?: number; now?: Date } = {},
): Promise<ReconcileSweepResult> {
  const empty: ReconcileSweepResult = { scanned: 0, settled: 0, stillPending: 0, failed: 0, skipped: false };

  if (paymentGateway.provider === 'mock') return { ...empty, skipped: true };

  const olderThanMs = Math.max(60_000, options.olderThanMs ?? 5 * 60_000);
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? 20)));
  const now = options.now ?? new Date();

  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: { in: ['CREATED', 'PENDING'] },
      createdAt: { lt: new Date(now.getTime() - olderThanMs) },
      expiresAt: { gt: now },
      providerPaymentId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const result: ReconcileSweepResult = { ...empty, scanned: orders.length };

  for (const order of orders) {
    try {
      const reconciled = await reconcilePaymentOrder({ tenantId: order.tenantId, orderId: order.id });
      if (reconciled.status === 'CAPTURED') result.settled += 1;
      else result.stillPending += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`✖ Reconcile failed for payment order ${order.id}:`, err);
    }
  }

  return result;
}
