import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search, Trophy } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import type { ManageMatchListResult, ManageMatchRow } from '../../types';
import { useToast } from '../../components/common/Toast';
import { useRealtime } from '../../context/RealtimeContext';
import { ManageMatchPanel, money, statusTone } from './ManageMatchPanel';

type Filter = 'live' | 'upcoming' | 'all';

const TABS: Array<{ id: Filter; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All' },
];

function when(matchTime: string): string {
  const start = new Date(matchTime).getTime();
  const diff = start - Date.now();
  if (Number.isNaN(diff)) return '—';
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const label = mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
  return diff >= 0 ? `starts in ${label}` : `started ${label} ago`;
}

/**
 * Manage Matches — one page for the whole match lifecycle.
 *
 * Rows, not cards: an admin scanning ten matches should see the seat count and
 * the pool without opening anything. Expanding a row keeps the page (and the
 * search box) exactly where it was, which is the difference between controlling
 * a live match and losing your place every time you click.
 */
export function ManageMatchesScreen() {
  const toast = useToast();
  const { version } = useRealtime();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<ManageMatchListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce so a fast typist triggers one query, not ten.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const next = await api.manage.list(filter, debounced);
      setData(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }, [filter, debounced, toast]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const matches = data?.matches ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Trophy className="h-5 w-5 text-cyan-500" />
            Manage Matches
          </h1>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
            Joins, room ID, live kills, bans, refunds and the final payout — all on one page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300/70 px-3 text-xs font-bold hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      {/* Search + tabs share one bar so the list never jumps around. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search match, IGN, Free Fire UID or phone…"
            aria-label="Search matches"
            className="h-10 w-full rounded-lg border border-slate-300/70 bg-white/80 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-300/70 p-1 dark:border-white/10">
          {TABS.map((tab) => {
            const active = filter === tab.id;
            const count =
              tab.id === 'live'
                ? data?.counts.live
                : tab.id === 'upcoming'
                  ? data?.counts.upcoming
                  : data?.counts.all;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`h-8 rounded-md px-3 text-xs font-bold ${
                  active
                    ? 'bg-cyan-600 text-white'
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading matches…
        </div>
      ) : matches.length === 0 ? (
        <p className="rounded-xl border border-slate-200/70 bg-white/60 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          {debounced ? `No match matches “${debounced}”.` : 'No matches here yet.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              open={openId === match.id}
              onToggle={() => setOpenId((current) => (current === match.id ? null : match.id))}
              onMatchChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  open,
  onToggle,
  onMatchChanged,
}: {
  match: ManageMatchRow;
  open: boolean;
  onToggle: () => void;
  onMatchChanged: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const fill = match.totalSlots > 0 ? Math.min(100, (match.joined / match.totalSlots) * 100) : 0;

  return (
    <div className={open ? 'bg-cyan-50/40 dark:bg-cyan-950/10' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-slate-200/60 px-3 py-2.5 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
      >
        <Chevron className="h-4 w-4 text-slate-400" />

        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-black">
              #{match.matchNumber ?? '—'} · {match.mapType}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              <span className={statusTone(match.status)}>{match.status.replace('_', ' ')}</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {match.matchType} · {match.gameMode === 'CLASH_SQUAD' ? 'CS' : 'BR'} · {when(match.matchTime)}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span>
              {match.joined}/{match.totalSlots} seats
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${fill}%` }} />
              </span>
            </span>
            <span>pool {money(match.prizePool)}</span>
            <span>{money(match.perKillPrize)}/kill</span>
            {match.totalKills > 0 ? <span>{match.totalKills} kills</span> : null}
            {match.finished > 0 ? <span>{match.finished} done</span> : null}
            {match.banned > 0 ? (
              <span className="font-bold text-rose-600 dark:text-rose-300">{match.banned} banned</span>
            ) : null}
            {match.roomPublished ? (
              <span className="text-emerald-700 dark:text-emerald-300">room published</span>
            ) : null}
          </span>
        </span>

        <span className="text-[12px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
          {money(match.prizePool)}
        </span>
      </button>

      {open ? <ManageMatchPanel match={match} onMatchChanged={onMatchChanged} /> : null}
    </div>
  );
}