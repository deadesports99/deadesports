import React from 'react';
import { MyMatch, MyMatchBucket, MyMatchesSummary, Theme } from '../types';
import { cx } from '../utils/formatters';
import { MyMatchesSummaryStrip } from '../components/myMatches/MyMatchesSummary';
import { MyMatchCard } from '../components/myMatches/MyMatchCard';

const BUCKETS: Array<{ id: MyMatchBucket; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const EMPTY_COPY: Record<MyMatchBucket, { title: string; hint: string }> = {
  all: {
    title: 'No matches played yet',
    hint: 'Join a tournament and your seat, rank, kills and prize money will show up here.',
  },
  upcoming: {
    title: 'No upcoming matches',
    hint: 'New entries appear here as soon as you take a slot in the lobby.',
  },
  live: {
    title: 'Nothing live right now',
    hint: 'Matches you are playing appear here once the organiser starts them.',
  },
  completed: {
    title: 'No finished matches yet',
    hint: 'Results and payouts show up after the organiser publishes them.',
  },
  cancelled: {
    title: 'No cancelled matches',
    hint: 'If a match you paid for is cancelled, the refund appears here.',
  },
};

interface MyMatchesScreenProps {
  theme: Theme;
  summary: MyMatchesSummary | null;
  matches: MyMatch[];
  bucket: MyMatchBucket;
  onBucket: (bucket: MyMatchBucket) => void;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onRoom: (match: MyMatch) => void;
  onBrowse?: () => void;
}

/**
 * "My Matches" — the player's own record, next to the Tournaments lobby.
 *
 * Careers strip on top, status filters, then one card per seat paid for. Cards
 * show an outcome (Joined / Room Ready / Live / Rank / Refunded), never a Join
 * button: joining happens in the lobby.
 */
export function MyMatchesScreen({
  theme,
  summary,
  matches,
  bucket,
  onBucket,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onRefresh,
  onLoadMore,
  onRoom,
  onBrowse,
}: MyMatchesScreenProps) {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-4">
      {summary && <MyMatchesSummaryStrip theme={theme} summary={summary} />}

      {/* Status filters — same chip language as the lobby */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {BUCKETS.map(({ id, label }) => {
          const selected = bucket === id;
          const count =
            id === 'upcoming'
              ? summary?.upcomingCount
              : id === 'live'
              ? summary?.liveCount
              : id === 'completed'
              ? summary?.completedCount
              : id === 'cancelled'
              ? summary?.cancelledCount
              : summary?.matchesJoined;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onBucket(id)}
              className={cx(
                'shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95',
                selected
                  ? isDark
                    ? 'border-white bg-white font-black text-slate-950'
                    : 'border-slate-950 bg-slate-950 font-black text-white shadow-sm'
                  : isDark
                  ? 'border-white/10 bg-[#0B1526] text-slate-300 hover:text-white'
                  : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100'
              )}
            >
              {label}
              {typeof count === 'number' && count > 0 && (
                <span
                  className={cx(
                    'ml-1 rounded px-1 text-[9px] font-black',
                    selected
                      ? isDark
                        ? 'bg-slate-950/15 text-slate-900'
                        : 'bg-white/20 text-white'
                      : isDark
                      ? 'bg-white/10 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className={cx('text-xs font-black uppercase tracking-wider', isDark ? 'text-slate-200' : 'text-slate-900')}>
            Matches ({matches.length})
          </h3>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            className={cx('text-[10px] font-bold', isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {loading && matches.length === 0 && (
          <div
            className={cx(
              'animate-pulse rounded-xl border p-4 text-center text-[11px]',
              isDark ? 'border-white/10 bg-[#0B1526] text-slate-400' : 'border-slate-200 bg-white text-slate-500'
            )}
          >
            Loading your match history…
          </div>
        )}

        {!loading && matches.length === 0 && (
          <div
            className={cx(
              'rounded-xl border px-4 py-6 text-center',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-white shadow-sm'
            )}
          >
            <p className={cx('text-[12px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
              {EMPTY_COPY[bucket].title}
            </p>
            <p className={cx('mt-1 text-[11px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {EMPTY_COPY[bucket].hint}
            </p>
            {onBrowse && (bucket === 'all' || bucket === 'upcoming') && (
              <button
                type="button"
                onClick={onBrowse}
                className="mt-3 rounded-lg bg-[#FFD000] px-3.5 py-1.5 text-[11px] font-black text-slate-950 transition-all active:scale-95 hover:bg-[#FFDA29]"
              >
                Browse tournaments
              </button>
            )}
          </div>
        )}

        {matches.map((match) => (
          <MyMatchCard
            key={match.id}
            theme={theme}
            match={match}
            onRoom={() => onRoom(match)}
          />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={() => onLoadMore?.()}
            disabled={loadingMore}
            className={cx(
              'w-full rounded-xl border py-2.5 text-[11px] font-black transition-all active:scale-[0.99]',
              isDark
                ? 'border-white/10 bg-[#0B1526] text-slate-200 hover:border-white/20'
                : 'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-400'
            )}
          >
            {loadingMore ? 'Loading…' : 'Load more matches'}
          </button>
        )}
      </div>
    </div>
  );
}
