import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Search,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import type { ManageMatchListResult, ManageMatchRow } from '../../types';
import { useToast } from '../../components/common/Toast';
import { useRealtime } from '../../context/RealtimeContext';
import { ManageMatchPanel, money } from './ManageMatchPanel';
import { collectedPool } from '../../lib/matchUi';

type Filter = 'live' | 'upcoming' | 'closed' | 'all';

const TABS: Array<{ id: Filter; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Finished' },
  { id: 'all', label: 'All' },
];

/** Status buckets — the same split the backend uses for its facet counts. */
const WAITING = ['STARTING_SOON'] as const;
const LIVE = ['LIVE', 'UNDER_REVIEW'] as const;
const PRE_MATCH = ['DRAFT', 'OPEN', 'UPCOMING', 'SLOTS_FULL', 'ROOM_REVEALED'] as const;
const FINISHED = ['COMPLETED', 'CANCELLED'] as const;

const inBucket = (status: string, bucket: readonly string[]) => bucket.includes(status);

/**
 * Remaining time as d:h:m:s — the owner asked for a real clock, not "2h".
 * Days are only shown when there are any, so a match starting in 12 minutes
 * reads `00:11:58` instead of `0d 00:11:58`.
 */
export function formatDhms(matchTime: string, now: number): string {
  const diff = Math.max(0, new Date(matchTime).getTime() - now);
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function statusPill(status: string): string {
  if (inBucket(status, FINISHED)) return 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300';
  if (inBucket(status, WAITING)) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
  if (inBucket(status, LIVE)) return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300';
}

interface Section {
  id: Filter | 'waiting' | 'live' | 'upcoming';
  label: string;
  tone: string;
  hint: string;
  rows: ManageMatchRow[];
}

/**
 * Manage Matches — one page for the whole match lifecycle.
 *
 * Ordering rule from the owner: the match that starts soonest is always on top,
 * and every countdown is a real d:h:m:s clock. Finished matches never mix with
 * live ones — they sit in their own section at the bottom.
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

  // One ticking clock for the whole page — a per-row interval would be silly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // `?publish=<id>` deep links (Matches screen, Live Scorer) open that row.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkMatchId = searchParams.get('publish');

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

  // Open the deep-linked match once its row is actually in the list.
  useEffect(() => {
    if (!deepLinkMatchId) return;
    if (data?.matches.some((match) => match.id === deepLinkMatchId)) {
      setOpenId(deepLinkMatchId);
      setSearchParams({}, { replace: true });
    }
  }, [deepLinkMatchId, data, setSearchParams]);

  const matches = data?.matches ?? [];
  const awaitingStart = data?.counts.awaitingStart ?? 0;

  /**
   * Soonest kickoff first (that is the row an organiser must act on), and
   * finished matches newest-first because a past match only matters for payout.
   */
  const sections = useMemo<Section[]>(() => {
    const bySoonest = [...matches].sort(
      (a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime(),
    );
    const byNewest = [...matches].sort(
      (a, b) => new Date(b.matchTime).getTime() - new Date(a.matchTime).getTime(),
    );

    if (filter === 'live') {
      return [
        {
          id: 'live',
          label: 'Live now',
          tone: 'text-rose-600 dark:text-rose-300',
          hint: 'Started matches — score them, then press Submit to move them to Final Payout.',
          rows: bySoonest.filter((match) => inBucket(match.status, LIVE)),
        },
      ];
    }

    if (filter === 'upcoming') {
      const rows = bySoonest.filter(
        (match) => inBucket(match.status, PRE_MATCH) || inBucket(match.status, WAITING),
      );
      return [
        {
          id: 'upcoming',
          label: 'Upcoming',
          tone: 'text-cyan-700 dark:text-cyan-300',
          hint: 'Soonest start is on top. Waiting matches need “Start match now”.',
          rows,
        },
      ];
    }

    if (filter === 'closed') {
      return [
        {
          id: 'closed',
          label: 'Finished matches',
          tone: 'text-slate-600 dark:text-slate-300',
          hint: 'Completed and cancelled matches — payouts and refunds already handled.',
          rows: byNewest.filter((match) => inBucket(match.status, FINISHED)),
        },
      ];
    }

    const groups: Section[] = [
      {
        id: 'waiting',
        label: 'Waiting to start',
        tone: 'text-amber-700 dark:text-amber-300',
        hint: 'Kickoff passed — publish the room and press “Start match now”.',
        rows: bySoonest.filter((match) => inBucket(match.status, WAITING)),
      },
      {
        id: 'live',
        label: 'Live now',
        tone: 'text-rose-600 dark:text-rose-300',
        hint: 'Started matches still being scored.',
        rows: bySoonest.filter((match) => inBucket(match.status, LIVE)),
      },
      {
        id: 'upcoming',
        label: 'Upcoming',
        tone: 'text-cyan-700 dark:text-cyan-300',
        hint: 'Soonest start is on top.',
        rows: bySoonest.filter((match) => inBucket(match.status, PRE_MATCH)),
      },
      {
        id: 'closed',
        label: 'Finished',
        tone: 'text-slate-600 dark:text-slate-300',
        hint: 'Already settled — kept separate so they never bury a live match.',
        rows: byNewest.filter((match) => inBucket(match.status, FINISHED)),
      },
    ];
    return groups.filter((section) => section.rows.length > 0);
  }, [matches, filter]);

  const totalShown = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const nextUp = useMemo(
    () =>
      matches
        .filter((match) => inBucket(match.status, PRE_MATCH))
        .sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime())[0] ?? null,
    [matches],
  );

  return (
    <div className="space-y-4">
      {/* Waiting queue: these rows are parked until the admin presses start. */}
      {awaitingStart > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          {awaitingStart} match{awaitingStart === 1 ? '' : 'es'} waiting to start — open one and press
          <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[11px] font-black text-white">
            Start match now
          </span>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Trophy className="h-5 w-5 text-cyan-500" />
            Manage Matches
          </h1>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
            Room ID, start, live kills, bans and refunds. Press Submit when scoring is done —
            the money is released in Final Payout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextUp ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/70 bg-cyan-50 px-2.5 py-1.5 text-[12px] font-black tabular-nums text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
              <Timer className="h-3.5 w-3.5" />
              Next #{nextUp.matchNumber ?? '—'} in {formatDhms(nextUp.matchTime, now)}
            </span>
          ) : null}
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
            const count = data?.counts[tab.id];
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
      ) : totalShown === 0 ? (
        <p className="rounded-xl border border-slate-200/70 bg-white/60 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          {debounced ? `No match matches “${debounced}”.` : 'No matches here yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => {
            const next = section.rows.find((match) => inBucket(match.status, PRE_MATCH));
            return (
              <section
                key={section.id}
                className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                  {section.id === 'live' ? (
                    <Flame className="h-3.5 w-3.5 text-rose-500" />
                  ) : section.id === 'waiting' ? (
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <h2 className={`text-[12px] font-black uppercase tracking-wide ${section.tone}`}>
                    {section.label}
                  </h2>
                  <span className="rounded-md border border-slate-200 px-1.5 text-[11px] font-black tabular-nums text-slate-600 dark:border-white/10 dark:text-slate-300">
                    {section.rows.length}
                  </span>
                  <span className="hidden text-[11.5px] font-medium text-slate-500 sm:inline dark:text-slate-400">
                    {section.hint}
                  </span>
                  {next ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-cyan-50 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
                      <Timer className="h-3 w-3" />
                      {formatDhms(next.matchTime, now)}
                    </span>
                  ) : null}
                </header>

                {section.rows.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    now={now}
                    open={openId === match.id}
                    onToggle={() => setOpenId((current) => (current === match.id ? null : match.id))}
                    onMatchChanged={() => void load()}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The clock cell: d:h:m:s while waiting, LIVE / finished once it is over. */
function KickoffClock({ match, now }: { match: ManageMatchRow; now: number }) {
  if (inBucket(match.status, FINISHED)) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">finished</span>
    );
  }
  if (inBucket(match.status, LIVE)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> live
      </span>
    );
  }
  if (inBucket(match.status, WAITING)) {
    return (
      <span className="text-[11px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
        waiting
      </span>
    );
  }
  const left = new Date(match.matchTime).getTime() - now;
  return (
    <span
      className={`text-[13px] font-black tabular-nums ${
        left <= 5 * 60_000
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-slate-800 dark:text-slate-100'
      }`}
      title="Time left until kickoff (days:hours:minutes:seconds)"
    >
      {formatDhms(match.matchTime, now)}
    </span>
  );
}

function MatchRow({
  match,
  now,
  open,
  onToggle,
  onMatchChanged,
}: {
  match: ManageMatchRow;
  now: number;
  open: boolean;
  onToggle: () => void;
  onMatchChanged: () => void;
}) {
  const navigate = useNavigate();
  const Chevron = open ? ChevronDown : ChevronRight;
  const fill = match.totalSlots > 0 ? Math.min(100, (match.joined / match.totalSlots) * 100) : 0;

  return (
    <div className={open ? 'bg-cyan-50/40 dark:bg-cyan-950/10' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-slate-200/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
      >
        <Chevron className="h-4 w-4 text-slate-400" />

        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-black">
              #{match.matchNumber ?? '—'} · {match.mapType}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusPill(match.status)}`}
            >
              {statusLabel(match.status)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {match.matchType} · {match.gameMode === 'CLASH_SQUAD' ? 'CS' : 'BR'}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span>
              {match.joined}/{match.totalSlots} seats
            </span>
            <span
              role="link"
              tabIndex={0}
              title="Every joined player, earliest join first"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/matches/${match.id}/players`);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                navigate(`/matches/${match.id}/players`);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-1.5 py-0.5 font-black text-cyan-800 underline decoration-dotted decoration-1 underline-offset-2 hover:bg-cyan-400/20 dark:text-cyan-200"
            >
              <Users className="h-3 w-3" />
              {match.joined > 0 ? `View all ${match.joined} joined` : 'View all joined'}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${fill}%` }} />
              </span>
            </span>
            <span>entry {money(match.entryFee)}</span>
            <span>{money(match.perKillPrize)}/kill</span>
            {match.totalKills > 0 ? <span>{match.totalKills} kills</span> : null}
            {match.finished > 0 ? <span>{match.finished} done</span> : null}
            {match.banned > 0 ? (
              <span className="font-bold text-rose-600 dark:text-rose-300">{match.banned} banned</span>
            ) : null}
            {inBucket(match.status, LIVE) ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                live · {match.joined}/{match.totalSlots} joined — view status
              </span>
            ) : match.roomPublished ? (
              <span className="text-emerald-700 dark:text-emerald-300">room published</span>
            ) : inBucket(match.status, WAITING) ? (
              <span className="font-bold text-amber-700 dark:text-amber-300">no room published yet</span>
            ) : null}
          </span>
        </span>

        <span className="flex flex-col items-end gap-0.5">
          <KickoffClock match={match} now={now} />
          <span className="text-[10.5px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
            {money(collectedPool({ entryFee: match.entryFee, slotsBooked: match.joined }))} collected
          </span>
        </span>
      </button>

      {open ? <ManageMatchPanel match={match} onMatchChanged={onMatchChanged} /> : null}
    </div>
  );
}
