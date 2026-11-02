import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────

/**
 * UPI UTR / RRN reference: UPI apps show a 12-digit (sometimes 12-char)
 * reference number. We accept exactly 12 alphanumeric characters.
 */
export const UTR_REGEX = /^[A-Za-z0-9]{12}$/;

/** Add-cash limits. */
export const MIN_DEPOSIT = 10;
export const MAX_DEPOSIT = 50000;

/** Max simultaneous pending requests per player (anti-spam). */
const MAX_PENDING_REQUESTS = 5;

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ─── SHARED VIEWS ────────────────────────────────────────────────────────

export interface PlayerDepositView {
  id: string;
  amount: string;
  utrNumber: string;
  status: string;
  rejectionNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface AdminDepositView extends PlayerDepositView {
  player: {
    id: string;
    inGameName: string | null;
    inGameUid: string | null;
    phoneNumber: string;
  };
}

type DecimalLike = { toFixed(precision: number): string };

function toPlayerView(row: {
  id: string;
  amount: DecimalLike;
  utrNumber: string;
  status: string;
  rejectionNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): PlayerDepositView {
  return {
    id: row.id,
    amount: Number(row.amount).toFixed(2),
    utrNumber: row.utrNumber,
    status: row.status,
    rejectionNote: row.rejectionNote,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

// ─── PLAYER: SUBMIT "ADD CASH" REQUEST ───────────────────────────────────

export interface DepositInput {
  amount: number;
  utrNumber: string;
}

/**
 * Player paid the client's UPI ID outside the app and submits the UTR
 * reference. Nothing is credited yet — money only lands in the wallet when
 * an admin approves the request (see approveDeposit).
 */
export async function submitDeposit(
  userId: string,
  tenantId: string,
  input: DepositInput,
) {
  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('A valid deposit amount is required');
  }
  if (amount < MIN_DEPOSIT) {
    throw ApiError.badRequest(`Minimum deposit is ₹${MIN_DEPOSIT}`);
  }
  if (amount > MAX_DEPOSIT) {
    throw ApiError.badRequest(`Maximum deposit is ₹${MAX_DEPOSIT}`);
  }

  const utrNumber = input.utrNumber.trim().toUpperCase();
  if (!UTR_REGEX.test(utrNumber)) {
    throw ApiError.badRequest('UTR must be exactly 12 letters/digits (from your UPI app)');
  }

  const [duplicate, pending, player] = await Promise.all([
    prisma.depositRequest.findFirst({
      where: { tenantId, utrNumber, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    }),
    prisma.depositRequest.count({ where: { userId, tenantId, status: 'PENDING' } }),
    prisma.user.findFirst({ where: { id: userId, tenantId }, select: { isBanned: true } }),
  ]);

  if (!player) throw ApiError.notFound('User not found');
  if (player.isBanned) throw ApiError.forbidden('Your account has been banned');
  if (duplicate) {
    throw ApiError.conflict('This UTR is already submitted — check your wallet or contact support');
  }
  if (pending >= MAX_PENDING_REQUESTS) {
    throw ApiError.conflict('You already have several pending deposits. Please wait for approval');
  }

  const created = await prisma.depositRequest.create({
    data: { tenantId, userId, amount, utrNumber, status: 'PENDING' },
  });

  return {
    deposit: toPlayerView(created),
    message: 'Deposit submitted — your balance will be credited after admin verification',
  };
}

/** Player: own deposit request history (newest first). */
export async function listPlayerDeposits(userId: string, tenantId: string, limit = 10) {
  const rows = await prisma.depositRequest.findMany({
    where: { userId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(50, Math.max(1, limit)),
  });

  const deposits = rows.map(toPlayerView);
  const pendingAmount = rows
    .filter((row) => row.status === 'PENDING')
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return { deposits, count: deposits.length, pendingAmount: round2(pendingAmount) };
}

// ─── ADMIN: VERIFICATION QUEUE ───────────────────────────────────────────

/** Admin/staff: list deposit requests (default PENDING). */
export async function listDeposits(tenantId: string, status?: string) {
  const where = {
    tenantId,
    ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
      : {}),
  };

  const rows = await prisma.depositRequest.findMany({
    where,
    include: {
      user: { select: { id: true, inGameName: true, inGameUid: true, phoneNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const deposits: AdminDepositView[] = rows.map((row) => ({
    ...toPlayerView(row),
    player: row.user,
  }));

  const pendingTotal = rows
    .filter((row) => row.status === 'PENDING')
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return { deposits, count: deposits.length, pendingTotal: round2(pendingTotal) };
}

/**
 * Admin/staff: approve a deposit — credits the player's DEPOSIT balance and
 * writes the double-entry ledger row (CREDIT / ADD_MONEY / DEPOSIT).
 * Idempotent-safe: the status flip is a conditional update, so a double tap
 * can never credit twice.
 */
export async function approveDeposit(
  adminId: string,
  tenantId: string,
  depositId: string,
) {
  const existing = await prisma.depositRequest.findFirst({
    where: { id: depositId, tenantId },
  });
  if (!existing) throw ApiError.notFound('Deposit request not found');
  if (existing.status !== 'PENDING') {
    throw ApiError.conflict(`Deposit is already ${existing.status}`);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // Conditional flip: only one caller can move PENDING -> APPROVED.
      const claimed = await tx.depositRequest.updateMany({
        where: { id: depositId, tenantId, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw ApiError.conflict('Deposit request was already processed');
      }

      const creditedUser = await tx.user.update({
        where: { id: existing.userId },
        data: { depositBalance: { increment: existing.amount } },
      });

      await tx.walletLedger.create({
        data: {
          tenantId,
          userId: existing.userId,
          amount: existing.amount,
          balanceType: 'DEPOSIT',
          type: 'CREDIT',
          category: 'ADD_MONEY',
          balanceAfter: creditedUser.depositBalance,
          referenceId: depositId,
          notes: `Add cash approved (UTR ${existing.utrNumber})`,
        },
      });

      const updated = await tx.depositRequest.findUniqueOrThrow({ where: { id: depositId } });
      return { updated, depositBalance: creditedUser.depositBalance };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 20000,
    },
  );

  return {
    deposit: toPlayerView(result.updated),
    depositBalance: round2(Number(result.depositBalance)),
    message: 'Deposit approved and balance credited',
  };
}

/** Admin/staff: reject a deposit request (no money was ever credited). */
export async function rejectDeposit(
  adminId: string,
  tenantId: string,
  depositId: string,
  reason: string,
) {
  if (reason.trim().length < 3) {
    throw ApiError.badRequest('A rejection reason of at least 3 characters is required');
  }

  const existing = await prisma.depositRequest.findFirst({
    where: { id: depositId, tenantId },
  });
  if (!existing) throw ApiError.notFound('Deposit request not found');
  if (existing.status !== 'PENDING') {
    throw ApiError.conflict(`Deposit is already ${existing.status}`);
  }

  const rejected = await prisma.depositRequest.updateMany({
    where: { id: depositId, tenantId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      rejectionNote: reason.trim(),
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });
  if (rejected.count !== 1) {
    throw ApiError.conflict('Deposit request was already processed');
  }

  const updated = await prisma.depositRequest.findUniqueOrThrow({ where: { id: depositId } });

  return {
    deposit: toPlayerView(updated),
    message: 'Deposit request rejected',
  };
}
