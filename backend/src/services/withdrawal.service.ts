import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────

/** UPI ID format: handle@bank — e.g. rahul@okaxis, player99@ybl. */
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** Minimum withdrawal a player may request. */
export const MIN_WITHDRAWAL = 50;

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ─── PLAYER: REQUEST A WITHDRAWAL ───────────────────────────────────────

export interface WithdrawalInput {
  amount: number;
  upiId: string;
  deviceId?: string;
}

/**
 * Player requests a UPI payout from their winning balance.
 * The money is deducted immediately (held) and the request enters the
 * admin approval queue. If the admin rejects it, the balance is refunded.
 */
export async function requestWithdrawal(
  userId: string,
  tenantId: string,
  input: WithdrawalInput,
) {
  if (!UPI_ID_REGEX.test(input.upiId)) {
    throw ApiError.badRequest('Invalid UPI ID — expected handle@bank (e.g. player@okaxis)');
  }
  if (input.amount < MIN_WITHDRAWAL) {
    throw ApiError.badRequest(`Minimum withdrawal is ₹${MIN_WITHDRAWAL}`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // 1) Atomic hold on the winning balance (only winning money is withdrawable).
      const held = await tx.user.updateMany({
        where: { id: userId, tenantId, isBanned: false, winningBalance: { gte: input.amount } },
        data: { winningBalance: { decrement: input.amount } },
      });
      if (held.count !== 1) {
        throw ApiError.badRequest('Insufficient winning balance for this withdrawal');
      }

      const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      // 2) Double-entry ledger: DEBIT / WITHDRAWAL (money held).
      await tx.walletLedger.create({
        data: {
          tenantId,
          userId,
          amount: input.amount,
          balanceType: 'WINNING',
          type: 'DEBIT',
          category: 'WITHDRAWAL',
          balanceAfter: updatedUser.winningBalance,
          notes: `Withdrawal request to ${input.upiId} (pending approval)`,
        },
      });

      // 3) Approval queue entry.
      const request = await tx.withdrawalRequest.create({
        data: {
          tenantId,
          userId,
          amount: input.amount,
          upiId: input.upiId.trim(),
          deviceId: input.deviceId,
          status: 'PENDING',
        },
      });

      return { request, winningBalance: updatedUser.winningBalance };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 20000,
    },
  );

  return {
    withdrawal: result.request,
    winningBalance: round2(Number(result.winningBalance)),
  };
}

// ─── ADMIN: APPROVAL QUEUE ───────────────────────────────────────────────

export interface AdminWithdrawalView {
  id: string;
  amount: string;
  upiId: string;
  status: string;
  deviceId: string | null;
  createdAt: Date;
  utrNumber: string | null;
  rejectionNote: string | null;
  player: { id: string; inGameName: string | null; inGameUid: string | null; phoneNumber: string };
}

function toAdminView(row: {
  id: string;
  amount: { toFixed(precision: number): string };
  upiId: string;
  status: string;
  deviceId: string | null;
  createdAt: Date;
  utrNumber: string | null;
  rejectionNote: string | null;
  player: { id: string; inGameName: string | null; inGameUid: string | null; phoneNumber: string };
}): AdminWithdrawalView {
  return {
    id: row.id,
    amount: Number(row.amount).toFixed(2),
    upiId: row.upiId,
    status: row.status,
    deviceId: row.deviceId,
    createdAt: row.createdAt,
    utrNumber: row.utrNumber,
    rejectionNote: row.rejectionNote,
    player: row.player,
  };
}

/** Admin/staff wallet console: list withdrawal requests (default PENDING). */
export async function listWithdrawals(tenantId: string, status?: string) {
  const where = {
    tenantId,
    ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
      : {}),
  };

  const rows = await prisma.withdrawalRequest.findMany({
    where,
    include: {
      user: { select: { id: true, inGameName: true, inGameUid: true, phoneNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const withdrawals: AdminWithdrawalView[] = rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount).toFixed(2),
    upiId: row.upiId,
    status: row.status,
    deviceId: row.deviceId,
    createdAt: row.createdAt,
    utrNumber: row.utrNumber,
    rejectionNote: row.rejectionNote,
    player: row.user,
  }));

  return { withdrawals, count: withdrawals.length };
}

/** Admin/staff: approve a pending withdrawal (UTR = proof of UPI transfer). */
export async function approveWithdrawal(
  adminId: string,
  tenantId: string,
  withdrawalId: string,
  utrNumber: string,
) {
  if (utrNumber.trim().length < 6) {
    throw ApiError.badRequest('UTR number must be at least 6 characters');
  }

  const existing = await prisma.withdrawalRequest.findFirst({
    where: { id: withdrawalId, tenantId },
  });
  if (!existing) throw ApiError.notFound('Withdrawal request not found');
  if (existing.status !== 'PENDING') {
    throw ApiError.conflict(`Withdrawal is already ${existing.status}`);
  }

  const updated = await prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: 'APPROVED',
      utrNumber: utrNumber.trim(),
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });

  return {
    withdrawal: {
      id: updated.id,
      status: updated.status,
      amount: Number(updated.amount).toFixed(2),
      upiId: updated.upiId,
      utrNumber: updated.utrNumber,
      reviewedAt: updated.reviewedAt,
    },
    message: 'Withdrawal approved and marked paid',
  };
}

/** Admin/staff: reject a pending withdrawal — automatically refunds the balance. */
export async function rejectWithdrawal(
  adminId: string,
  tenantId: string,
  withdrawalId: string,
  reason: string,
) {
  if (reason.trim().length < 3) {
    throw ApiError.badRequest('A rejection reason of at least 3 characters is required');
  }

  const existing = await prisma.withdrawalRequest.findFirst({
    where: { id: withdrawalId, tenantId },
  });
  if (!existing) throw ApiError.notFound('Withdrawal request not found');
  if (existing.status !== 'PENDING') {
    throw ApiError.conflict(`Withdrawal is already ${existing.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) Refund the held money to the winning balance.
    const credited = await tx.user.update({
      where: { id: existing.userId },
      data: { winningBalance: { increment: existing.amount } },
    });

    // 2) Double-entry ledger: CREDIT reversal.
    await tx.walletLedger.create({
      data: {
        tenantId,
        userId: existing.userId,
        amount: existing.amount,
        balanceType: 'WINNING',
        type: 'CREDIT',
        category: 'REFUND',
        balanceAfter: credited.winningBalance,
        referenceId: withdrawalId,
        notes: `Withdrawal to ${existing.upiId} rejected${reason ? `: ${reason}` : ''}`,
      },
    });

    // 3) Mark rejected.
    const updated = await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        rejectionNote: reason.trim(),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    return { updated, winningBalance: credited.winningBalance };
  });

  return {
    withdrawal: result.updated,
    message: 'Withdrawal rejected and balance refunded',
    winningBalance: round2(Number(result.winningBalance)),
  };
}