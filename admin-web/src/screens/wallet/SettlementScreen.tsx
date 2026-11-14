import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Download,
  Percent,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { InlineError, Chip } from '../matches/MatchFormBits';
import { formatINR, formatISTDate, formatISTTime, humanize } from '../../lib/format';
import { dateInputValue, istPartsOf } from '../../lib/istTime';
import type { DailySettlement } from '../../types';

type TxFilter = 'ALL' | 'CREDIT' | 'DEBIT';

const CATEGORY_LABEL: Record<string, string> = {
  ADD_MONEY: 'Add Cash',
  JOIN_FEE: 'Match entry',
  WINNING_PRIZE: 'Prize won',
  WITHDRAWAL: 'Withdrawal',
  REFUND: 'Refund',
  BONUS: 'Bonus',
  ADJUSTMENT: 'Adjustment',
};

function todayIst(): string {
  return dateInputValue(istPartsOf());
}

export function SettlementScreen() {
  const toast = useToast();

  const [date, setDate] = useState(todayIst);
  const [data, setData] = useState<DailySettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TxFilter>('ALL');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError('');
    try {
      setData(await api.wallet.settlement(day));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the settlement');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const rows = useMemo(() => {
    const list = data?.transactions ?? [];
    return filter === 'ALL' ? list : list.filter((tx) => tx.type === filter);
  }, [data, filter]);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.wallet.settlementCsv(date, `settlement-${date}.csv`);
      toast.success('Settlement CSV downloaded');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download the CSV');
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Money"
        title="Daily Settlement"
        subtitle="Money in, money out and the day's net margin — straight from the ledger."
        action={
          <>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              disabled={loading}
              onClick={() => void load(date)}
            >
              Refresh
            </AppButton>
            <AppButton
              size="sm"
              icon={<Download className="h-4 w-4" />}
              loading={exporting}
              disabled={!data}
              onClick={() => void exportCsv()}
            >
              CSV
            </AppButton>
          </>
        }
      />

      <GlassCard flat className="flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[150px]">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-500">
            Report date (IST)
          </span>
          <input
            type="date"
            value={date}
            max={todayIst()}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-bold text-slate-950 outline-none focus:border-[#FFD000]/70 dark:border-white/10 dark:bg-[#060B14] dark:text-white"
          />
        </label>
        <div className="flex flex-wrap gap-1.5 pb-1">
          {[
            { label: 'Today', offset: 0 },
            { label: 'Yesterday', offset: -1 },
            { label: '2 days ago', offset: -2 },
          ].map(({ label, offset }) => (
            <Chip
              key={label}
              onClick={() => {
                const parts = istPartsOf();
                const shifted = new Date(
                  Date.UTC(parts.year, parts.month - 1, parts.day) + offset * 86_400_000
                );
                setDate(
                  dateInputValue({
                    year: shifted.getUTCFullYear(),
                    month: shifted.getUTCMonth() + 1,
                    day: shifted.getUTCDate(),
                  })
                );
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
        <p className="pb-1 text-[10.5px] text-slate-500">
          Matches, deposits and withdrawals are counted in IST for this calendar day.
        </p>
      </GlassCard>

      {error && (
        <GlassCard flat className="p-4">
          <InlineError>{error}</InlineError>
        </GlassCard>
      )}

      {loading ? (
        <LoadingState label="Building the day's settlement…" />
      ) : !data || !s ? (
        <EmptyState
          icon={ShieldCheck}
          title="No settlement for this date"
          description="Pick another date or refresh."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Deposits in', value: formatINR(s.totalDeposits), note: `${s.depositCount} approved`, icon: ArrowDownToLine },
              { label: 'Withdrawals out', value: formatINR(s.totalWithdrawals), note: `${s.withdrawalCount} paid`, icon: ArrowUpFromLine },
              { label: 'Entry fees', value: formatINR(s.totalMatchRevenue), note: `${s.matchCount} matches`, icon: Swords },
              { label: 'Prizes paid', value: formatINR(s.totalPrizesPaid), note: `${s.prizeCount} payouts`, icon: Trophy },
              {
                label: 'Net margin',
                value: formatINR(s.netOrganizerProfit),
                note: s.netOrganizerProfit >= 0 ? 'profit' : 'loss',
                icon: Banknote,
              },
              {
                label: `Platform cut ${s.commissionRate}%`,
                value: formatINR(s.platformCut),
                note: 'on net margin',
                icon: Percent,
              },
            ].map(({ label, value, note, icon: Icon }) => (
              <GlassCard key={label} flat className="p-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Icon className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                </div>
                <p
                  className={
                    'mt-1 text-[15px] font-black leading-none ' +
                    (label === 'Net margin' && s.netOrganizerProfit < 0
                      ? 'text-rose-600 dark:text-rose-300'
                      : '')
                  }
                >
                  {value}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">{note}</p>
              </GlassCard>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'CREDIT', 'DEBIT'] as TxFilter[]).map((id) => (
                <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
                  {id === 'ALL' ? `All ${data.transactions.length}` : `${humanize(id)} ${data.transactions.filter((t) => t.type === id).length}`}
                </Chip>
              ))}
            </div>
            <p className="text-[10.5px] text-slate-500">
              {formatISTDate(`${date}T00:00:00+05:30`)} · ledger rows in IST
            </p>
          </div>

          <GlassCard className="p-3 sm:p-4">
            {rows.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No money moved"
                description="Nothing matches this filter on the selected day."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <th className="pb-2">Time (IST)</th>
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Head</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2 text-right">Balance after</th>
                      <th className="pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {rows.map((tx) => (
                      <tr key={tx.id} className="align-top">
                        <td className="py-2 text-[11px] font-semibold text-slate-500">
                          {formatISTTime(tx.createdAt)}
                        </td>
                        <td className="py-2 text-[12px] font-bold">
                          {tx.player.inGameName || tx.player.phoneNumber}
                        </td>
                        <td className="py-2 text-[11px] text-slate-500">
                          {CATEGORY_LABEL[tx.category] ?? humanize(tx.category)}
                          <span className="ml-1 text-[9.5px] uppercase">({tx.balanceType.toLowerCase()})</span>
                        </td>
                        <td
                          className={
                            'py-2 text-right text-[12px] font-black ' +
                            (tx.type === 'CREDIT'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-rose-600 dark:text-rose-300')
                          }
                        >
                          {tx.type === 'CREDIT' ? '+' : '−'}
                          {formatINR(tx.amount, 2)}
                        </td>
                        <td className="py-2 text-right text-[11px] font-semibold text-slate-500">
                          {formatINR(tx.balanceAfter, 2)}
                        </td>
                        <td className="max-w-[220px] py-2 text-[10.5px] text-slate-500">
                          {tx.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
