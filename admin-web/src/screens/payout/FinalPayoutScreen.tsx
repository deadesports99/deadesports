import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import type { ManageMatchRow, PayoutFilterTab, PayoutInbox, PayoutInboxRow } from '../../types';
import { useToast } from '../../components/common/Toast';
import { useRealtime } from '../../context/RealtimeContext';
import { ManageMatchPanel, money } from '../manage/ManageMatchPanel';

const TABS: Array<{ id: PayoutFilterTab; label: string }> = [
  { id: 'pending', label: 'To pay' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

function statusPill(status: string): string {
  if (status === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (status === 'CANCELLED') return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300';
  if (status === 'UNDER_REVIEW') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * The submitted match carries the same shape the manage panel needs, so the
 * admin gets the identical board (kills, bans, refund switch) inside the desk.
 */
function toPanelMatch(row: PayoutInboxRow): ManageMatchRow {
  return {
    id: row.id,
    matchNumber: row.matchNumber,
    title: row.title,
    gameMode: row.gameMode,
    matchType: row.matchType,
    mapType: row.mapType,
    status: row.status,
    entryFee: row.entryFee,
    perKillPrize: row.perKillPrize,
    totalSlots: row.totalSlots,
    joined: row.joined,
    banned: row.banned,
    totalKills: row.kills,
    finished: row.finished,
    matchTime: row.matchTime,
    roomId: row.roomId,
    roomPassword: row.roomPassword,
    hasRoomCredentials: row.hasRoomCredentials,
    roomPublished: row.roomPublished,
    payoutSubmittedAt: row.payoutSubmittedAt,
  };
}

/**
 * FINAL PAYOUT — the money desk after Manage Matches.
 *
 * Everything that was "Submit"ed in Manage Matches lands here: kills, bans,
 * refunds and the totals for one match. Releasing money needs the step-up OTP
 * (it is the only place in the app that pays a whole match at once), and a
 * payout larger than the cash collected is allowed from this desk.
 */
export function FinalPayoutScreen() {
  const toast = useToast();
  const { version } = useRealtime();

  const [filter, setFilter] = useState<PayoutFilterTab>('pending');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<PayoutInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const next = await api.manage.payoutInbox(filter, debounced);
      setData(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not load the payout desk');
    } finally {
      setLoading(false);
    }
  }, [filter, debounced, toast]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const header = useMemo(
    () =>
      filter === 'paid'
        ? 'Matches already settled — kept as payout history.'
        : 'Matches submitted from Manage Matches. Money is released here with the OTP.',
    [filter],
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Banknote className="h-5 w-5 text-emerald-500" />
            Final Payout
          </h1>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">{header}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-1.5 text-[12px] font-bold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            OTP needed to pay
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300/70 px-3 text-xs font-bold hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </header>

      {/* Money summary for whatever the current tab shows. */}
      {totals ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Collected" value={money(totals.collected)} hint="Entry fees of these matches" />
          <Stat label="Refunded" value={money(totals.refunded)} hint="Seat + banned-seat refunds" tone="text-slate-700 dark:text-slate-200" />
          <Stat label="Paid out" value={money(totals.paid)} hint="Already credited to players" tone="text-emerald-700 dark:text-emerald-300" />
          <Stat label="To pay" value={money(totals.payoutDue)} hint="Still owed at current kills" tone="text-violet-700 dark:text-violet-300" />
          <Stat
            label={totals.balance < 0 ? 'Short' : 'Left'}
            value={money(Math.abs(totals.balance))}
            hint="Collected − refunds − paid − to pay"
            tone={totals.balance < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search match, IGN, Free Fire UID or phone…"
            aria-label="Search submitted matches"
            className="h-10 w-full rounded-lg border border-slate-300/70 bg-white/80 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-300/70 p-1 dark:border-white/10">
          {TABS.map((tab) => {
            const active = filter === tab.id;
            const count = data?.counts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`h-8 rounded-md px-3 text-xs font-bold ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
                {typeof count === 'number' ? (
                  <span className={`ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the payout desk…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200/70 bg-white/60 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          {debounced
            ? `No submitted match matches “${debounced}”.`
            : filter === 'pending'
              ? 'Nothing waiting for payout. Press “Submit” in Manage Matches and the match appears here.'
              : 'No match has been paid yet.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
          <header className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
            <Banknote className="h-3.5 w-3.5 text-emerald-500" />
            <h2 className="text-[12px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {filter === 'paid' ? 'Settled' : 'Waiting for payout'}
            </h2>
            <span className="rounded-md border border-slate-200 px-1.5 text-[11px] font-black tabular-nums text-slate-600 dark:border-white/10 dark:text-slate-300">
              {rows.length}
            </span>
            <span className="hidden text-[11.5px] font-medium text-slate-500 sm:inline dark:text-slate-400">
              Open a row to edit kills, bans and refunds — then pay.
            </span>
          </header>

          {rows.map((row) => (
            <PayoutRow
              key={row.id}
              row={row}
              open={openId === row.id}
              onToggle={() => setOpenId((current) => (current === row.id ? null : row.id))}
              onMatchChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'text-slate-800 dark:text-slate-100',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]"
      title={hint}
    >
      <span className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className={`text-[15px] font-black tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

function PayoutRow({
  row,
  open,
  onToggle,
  onMatchChanged,
}: {
  row: PayoutInboxRow;
  open: boolean;
  onToggle: () => void;
  onMatchChanged: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const settled = row.status === 'COMPLETED';

  return (
    <div className={open ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-slate-200/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
      >
        <Chevron className="h-4 w-4 text-slate-400" />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-black text-slate-900 dark:text-slate-100">
              #{row.matchNumber ?? '—'} · {row.title}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusPill(row.status)}`}>
              {row.status.replace(/_/g, ' ')}
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {row.mapType} · {row.joined}/{row.totalSlots} seats
            </span>
            {row.banned > 0 ? (
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {row.banned} banned
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Submitted {timeAgo(row.payoutSubmittedAt)} · {row.kills} kills · collected {money(row.collected)}
            {row.refunded > 0 ? ` · refunded ${money(row.refunded)}` : ''}
          </div>
        </div>

        <div className="text-right">
          <span className={`block text-[13px] font-black tabular-nums ${settled ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300'}`}>
            {settled ? money(row.paid) : money(row.payoutDue)}
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {settled ? 'paid' : 'to pay'}
          </span>
        </div>
      </button>

      {open ? (
        <div className="border-b border-slate-200/60 px-3 py-3 dark:border-white/5">
          {settled ? (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11.5px] font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settled — {money(row.paid)} paid to {row.finished > 0 ? row.finished : 'the'} player(s). The board
              below is read-only history.
            </p>
          ) : null}
          <ManageMatchPanel match={toPanelMatch(row)} onMatchChanged={onMatchChanged} mode="payout" />
        </div>
      ) : null}
    </div>
  );
}