import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ─── WALLET SERVICE ──────────────────────────────────────────────────────
// Read-only wallet summary + double-entry ledger history for the /wallet
// endpoints. Every money movement is already double-entried into
// WalletLedger by the tournament engine (JOIN_FEE/REFUND/WINNING_PRIZE).

export interface WalletLedgerEntry {
  id: string;
  amount: string;
  balanceType: string;
  type: string;
  category: string;
  balanceAfter: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
}

function toLedgerEntry(row: {
  id: string;
  amount: PrismaDecimal;
  balanceType: string;
  type: string;
  category: string;
  balanceAfter: PrismaDecimal;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
}): WalletLedgerEntry {
  return {
    id: row.id,
    amount: Number(row.amount).toFixed(2),
    balanceType: row.balanceType,
    type: row.type,
    category: row.category,
    balanceAfter: Number(row.balanceAfter).toFixed(2),
    referenceId: row.referenceId,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

type PrismaDecimal = { toFixed(precision: number): string };

export interface WalletSummary {
  tenantId: string;
  depositBalance: string;
  winningBalance: string;
  totalBalance: string;
  ledger: WalletLedgerEntry[];
  pagination: { page: number; limit: number; total: number };
}

/**
 * Full wallet view: deposit + winning balances (as strings, 2dp) and the
 * user's recent ledger history (newest first).
 */
export async function getWalletSummary(
  userId: string,
  tenantId: string,
  page = 1,
  limit = 25,
): Promise<WalletSummary> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));

  const [user, total, rows] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { depositBalance: true, winningBalance: true },
    }),
    prisma.walletLedger.count({ where: { userId } }),
    prisma.walletLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  if (!user) throw ApiError.notFound('User not found');

  const deposit = Number(user.depositBalance);
  const winning = Number(user.winningBalance);

  return {
    tenantId,
    depositBalance: deposit.toFixed(2),
    winningBalance: winning.toFixed(2),
    totalBalance: (deposit + winning).toFixed(2),
    ledger: rows.map(toLedgerEntry),
    pagination: { page: safePage, limit: safeLimit, total },
  };
}
