import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, History, ListChecks, RefreshCw, Search, Zap } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useRealtime } from '../../context/RealtimeContext';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { formatIST } from '../../lib/format';
import { matchHeadline, money, seatsLabel } from '../../lib/matchUi';
import { InlineError } from './MatchFormBits';
import type { AdminTournament } from '../../types';

type Backlog = 'LIVE' | 'REVIEW';

/**
 * Live Scorer picker — LIVE matches first, plus the unscored backlog
 * (UNDER_REVIEW = the match ended but results are still pending).
 *
 * There is exactly ONE payout screen (`/matches/:id`) so the console never
 * grows a second, conflicting payout flow.
 */
export function ScorerPickerScreen() {
  const navigate = useNavigate();
  const { version } = useRealtime();

  const [items, setItems] = useState<AdminTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Backlog>('LIVE');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await api.matches.listAll();
      setItems(all);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (version > 0) void load();
  }, [version, load]);

  const live = useMemo(
    () => items.filter((match) => match.status === 'LIVE').sort((a, b) => new Date(b.matchTime).getTime() - new Date(a.matchTime).getTime()),
    [items]
  );
  const review = useMemo(
    () => items.filter((match) => match.status === 'UNDER_REVIEW').sort((a, b) => new Date(b.matchTime).getTime() - new Date(a.matchTime).getTime()),
    [items]
  );

  const shown = useMemo(() => {
    const source = tab === 'LIVE' ? live : review;
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((match) =>
      [String(match.matchNumber ?? ''), match.title, match.mapType, match.matchType]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [tab, live, review, search]);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Phase 4 · Match operations"
        title="Live Scorer"
        subtitle="Pick a live match to enter ranks, kills and DQ — then pay every player in one save."
        action={
          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </AppButton>
        }
      />

      {error && <InlineError>{error}</InlineError>}

      <GlassCard flat className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 gap-1.5">
            <button
              type="button"
              onClick={() => setTab('LIVE')}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-black transition-colors ${
                tab === 'LIVE'
                  ? 'border-rose-400/50 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5" /> Live
              <span className="rounded-md bg-slate-200 dark:bg-black/25 px-1 text-[9px] font-black">{live.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('REVIEW')}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-black transition-colors ${
                tab === 'REVIEW'
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-600 dark:text-amber-300'
                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" /> Unscored backlog
              <span className="rounded-md bg-slate-200 dark:bg-black/25 px-1 text-[9px] font-black">{review.length}</span>
            </button>
          </div>

          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Match number, map, mode…"
              aria-label="Search matches"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-[12px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#FFD000]/70 dark:border-white/10 dark:bg-[#060B14] dark:text-white dark:placeholder:text-slate-600"
            />
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <LoadingState rows={4} label="Loading matches…" />
      ) : shown.length === 0 ? (
        <GlassCard flat>
          <EmptyState
            icon={tab === 'LIVE' ? Zap : History}
            title={search ? 'No match matches that search' : tab === 'LIVE' ? 'No live matches right now' : 'No unscored backlog'}
            description={
              search
                ? 'Clear the search to see every match in this tab.'
                : tab === 'LIVE'
                  ? 'Matches flip to LIVE at kickoff (or with "Sweep now" on the Matches screen).'
                  : 'Matches that ended without results appear here after the lifecycle sweep.'
            }
            action={
              tab === 'LIVE' ? (
                <AppButton size="sm" variant="secondary" onClick={() => navigate('/matches')}>
                  Open matches
                </AppButton>
              ) : undefined
            }
          />
        </GlassCard>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((match) => (
            <li key={match.id}>
              <GlassCard flat className="flex h-full flex-col p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black">{matchHeadline(match)}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{formatIST(match.matchTime)}</p>
                  </div>
                  <StatusBadge status={match.status} />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                    {seatsLabel(match)}
                  </span>
                  <span className="rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-1.5 py-0.5 text-amber-600 dark:text-amber-300">
                    {money(Number(match.prizePool))} pool
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] px-1.5 py-0.5 text-slate-400">
                    ₹{Number(match.perKillPrize ?? 0)}/kill
                  </span>
                </div>

                <div className="mt-3 flex-1" />

                <AppButton
                  size="sm"
                  variant={match.status === 'LIVE' ? 'primary' : 'secondary'}
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  onClick={() => navigate(`/matches/${match.id}`)}
                  fullWidth
                >
                  {match.status === 'LIVE' ? 'Score & pay' : 'Finish results'}
                </AppButton>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}

      <GlassCard flat className="p-4">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" />
          One canonical payout flow: the match roster. Ranks 1–3 share the pool (50/30/20%), kills pay the
          per-kill rate, and already-paid players are never paid twice.
        </p>
      </GlassCard>
    </div>
  );
}
