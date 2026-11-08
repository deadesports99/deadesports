import { csvEscape } from '../utils/csv.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ─── DAILY SETTLEMENT & FINANCIAL RECONCILIATION ────────────────────────
// Phase 7 — the owner's "daily profit & loss" report. Every figure is built
// on the immutable double-entry WalletLedger (single source of truth), except
// deposits/withdrawals which are read from their approval queues so "approved
// on the date" is respected exactly. Match revenue is grouped by the match's
// scheduled calendar date, rather than only by when a join ledger row posted.

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Validate `YYYY-MM-DD` and return the [start, end) UTC day range. */
function dayRange(dateStr: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw ApiError.badRequest('date must be YYYY-MM-DD (e.g. 2025-01-31)');
  }
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest('date must be a valid calendar date');
  }
  return { start: parsed, end: new Date(parsed.getTime() + 24 * 60 * 60 * 1000) };
}

export interface SettlementSummary {
  date: string;
  /** Approved "Add Cash" deposits settled on the date (₹) & count. */
  totalDeposits: number;
  depositCount: number;
  /** Approved UPI withdrawals settled on the date (₹) & count. */
  totalWithdrawals: number;
  withdrawalCount: number;
  /** Entry fees actually collected (JOIN_FEE ledger) on the date (₹). */
  totalMatchRevenue: number;
  matchCount: number;
  /** Prize money credited to winners (WINNING_PRIZE ledger) on the date (₹). */
  totalPrizesPaid: number;
  prizeCount: number;
  /** Revenue retained by the organizer after prize payout. */
  netOrganizerProfit: number;
  /** The platform's commission share of net profit (tenant.commissionRate). */
  platformCut: number;
  commissionRate: number;
}

export interface SettlementTransactionRow {
  id: string;
  createdAt: Date;
  category: string;
  type: string;
  balanceType: string;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  notes: string | null;
  player: { id: string; name: string | null; inGameName: string | null; phoneNumber: string };
}

export interface DailySettlement {
  summary: SettlementSummary;
  transactions: SettlementTransactionRow[];
}

/**
 * Financial snapshot of a single calendar day for the tenant:
 * money in (deposits + entry fees), money out (withdrawals + prizes),
 * and the organizer's net margin after the platform commission.
 */
export async function getDailySettlement(
  tenantId: string,
  dateStr: string,
): Promise<DailySettlement> {
  const { start, end } = dayRange(dateStr);

  const scheduledMatches = await prisma.tournament.findMany({
    where: { tenantId, matchTime: { gte: start, lt: end } },
    select: { id: true },
  });
  const scheduledMatchIds = scheduledMatches.map((match) => match.id);

  const [deposits, withdrawals, revenueAgg, prizesAgg, matchRefs, txRows] = await Promise.all([
    // 1) Approved deposits on the date (approval time is the money movement).
    prisma.depositRequest.aggregate({
      where: { tenantId, status: 'APPROVED', reviewedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    // 2) Approved withdrawals on the date (approval time = money paid out).
    prisma.withdrawalRequest.aggregate({
      where: { tenantId, status: 'APPROVED', reviewedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    // 3) Entry fees collected for matches scheduled on the selected date.
    prisma.walletLedger.aggregate({
      where: {
        tenantId,
        category: 'JOIN_FEE',
        type: 'DEBIT',
        referenceId: { in: scheduledMatchIds },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // 4) Prizes disbursed: WINNING_PRIZE credits booked that day.
    prisma.walletLedger.aggregate({
      where: { tenantId, category: 'WINNING_PRIZE', type: 'CREDIT', createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    // 5) Distinct matches that produced entry-fee revenue that day.
    prisma.walletLedger.findMany({
      where: {
        tenantId,
        category: 'JOIN_FEE',
        type: 'DEBIT',
        referenceId: { in: scheduledMatchIds },
      },
      select: { referenceId: true },
      distinct: ['referenceId'],
    }),
    // 6) Every money movement of the day (CSV export source).
    prisma.walletLedger.findMany({
      where: { tenantId, createdAt: { gte: start, lt: end } },
      include: {
        user: {
          select: { id: true, name: true, inGameName: true, phoneNumber: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const totalDeposits = round2(Number(deposits._sum.amount ?? 0));
  const totalWithdrawals = round2(Number(withdrawals._sum.amount ?? 0));
  const totalMatchRevenue = round2(Number(revenueAgg._sum.amount ?? 0));
  const totalPrizesPaid = round2(Number(prizesAgg._sum.amount ?? 0));
  const netOrganizerProfit = round2(totalMatchRevenue - totalPrizesPaid);

  // Platform cut = the tenant's commission rate applied to net margin.
  const commissionRate = await prisma.tenant
    .findUnique({ where: { id: tenantId }, select: { commissionRate: true } })
    .then((t) => t?.commissionRate ?? 10);
  const platformCut = round2(netOrganizerProfit * (commissionRate / 100));

  return {
    summary: {
      date: dateStr,
      totalDeposits,
      depositCount: deposits._count,
      totalWithdrawals,
      withdrawalCount: withdrawals._count,
      totalMatchRevenue,
      matchCount: matchRefs.filter((r) => r.referenceId).length,
      totalPrizesPaid,
      prizeCount: prizesAgg._count,
      netOrganizerProfit,
      platformCut,
      commissionRate,
    },
    transactions: txRows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      category: row.category,
      type: row.type,
      balanceType: row.balanceType,
      amount: Number(row.amount),
      balanceAfter: Number(row.balanceAfter),
      referenceId: row.referenceId,
      notes: row.notes,
      player: row.user,
    })),
  };
}

// ─── CSV EXPORT ──────────────────────────────────────────────────────────

const CSV_HEADER =
  'S.No,Date,Time,Player,Phone,In-Game Name,Category,Type,Balance,Amount,Balance After,Reference,Notes';

/**
 * Clean, spreadsheet-ready CSV of the day's full ledger (money in/out),
 * prefixed with the settlement summary block so the owner sees P&L + rows
 * in a single download.
 */
export function buildSettlementCsv(settlement: DailySettlement): string {
  const { summary, transactions } = settlement;
  const lines: string[] = [];

  lines.push(`Daily Settlement Report,${summary.date}`);
  lines.push('Total Deposits (Approved),' + summary.totalDeposits.toFixed(2) + ',' + summary.depositCount);
  lines.push('Total Withdrawals (Approved),' + summary.totalWithdrawals.toFixed(2) + ',' + summary.withdrawalCount);
  lines.push('Total Entry Fees Collected,' + summary.totalMatchRevenue.toFixed(2) + ',' + summary.matchCount + ' match(es)');
  lines.push('Total Prizes Paid,' + summary.totalPrizesPaid.toFixed(2) + ',' + summary.prizeCount);
  lines.push('Net Organizer Profit,' + summary.netOrganizerProfit.toFixed(2));
  lines.push('Platform Cut (' + summary.commissionRate + '%),' + summary.platformCut.toFixed(2));
  lines.push('');
  lines.push(CSV_HEADER);

  transactions.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        row.createdAt.toISOString().slice(0, 10),
        row.createdAt.toISOString().slice(11, 19),
        csvEscape(row.player.name),
        csvEscape(row.player.phoneNumber),
        csvEscape(row.player.inGameName),
        row.category,
        row.type,
        row.balanceType,
        row.amount.toFixed(2),
        row.balanceAfter.toFixed(2),
        csvEscape(row.referenceId),
        csvEscape(row.notes),
      ].join(','),
    );
  });

  return lines.join('\r\n');
}
