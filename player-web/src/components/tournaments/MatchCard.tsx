import React, { useEffect, useState } from 'react';
import { Crosshair, Gamepad2, MapPin, Users } from 'lucide-react';
import { Theme, TournamentMatch } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { formatKickoffStamp } from '../../lib/mappers';

/** Minutes before kickoff at which the countdown turns urgent (red). */
const LIVE_SOON_SECONDS = 15 * 60;

/** Seconds left until kickoff, floored at 0. */
function secondsUntil(iso?: string): number {
  if (!iso) return 0;
  const kickoff = new Date(iso).getTime();
  if (Number.isNaN(kickoff)) return 0;
  return Math.max(0, Math.floor((kickoff - Date.now()) / 1000));
}

/** "2d 04h 10m" / "02:15:22" / "05:42" — compact and always monospace. */
function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Real per-second countdown to kickoff, with a pulsing dot in the last 15 min.
 *
 * Once kickoff has passed the clock means nothing: the match is not LIVE until
 * the organiser presses "Go live", so the card says STARTING SHORTLY instead of
 * a dead "STARTING NOW".
 */
function MatchCountdown({
  iso,
  isLive,
  awaitingStart,
  isDark,
}: {
  iso?: string;
  isLive?: boolean;
  awaitingStart?: boolean;
  isDark: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(iso));

  useEffect(() => {
    setSecondsLeft(secondsUntil(iso));
    const timer = window.setInterval(() => setSecondsLeft(secondsUntil(iso)), 1000);
    return () => window.clearInterval(timer);
  }, [iso]);

  const started = secondsLeft <= 0;
  const waiting = !isLive && Boolean(awaitingStart || started);
  const urgent = !isLive && !started && secondsLeft <= LIVE_SOON_SECONDS;
  const accent = waiting
    ? 'text-amber-500'
    : isLive || urgent
      ? 'text-rose-500'
      : isDark
        ? 'text-[#FFD000]'
        : 'text-[#B8860B]';

  return (
    <div className="flex shrink-0 flex-col items-end leading-none">
      <span
        className={cx(
          'text-[8px] font-bold uppercase tracking-[0.1em]',
          isDark ? 'text-slate-400' : 'text-slate-500'
        )}
      >
        {isLive ? 'Match' : waiting ? 'Match status' : 'Match starts in'}
      </span>
      <span className={cx('mt-1 flex items-center gap-1 font-mono font-black tracking-wide', waiting ? 'text-[11px]' : 'text-[13px]', accent)}>
        {(isLive || urgent || waiting) && (
          <span
            className={cx(
              'inline-block h-1.5 w-1.5 animate-pulse rounded-full',
              waiting ? 'bg-amber-500' : 'bg-rose-500'
            )}
          />
        )}
        {isLive ? 'LIVE NOW' : waiting ? 'STARTING SHORTLY' : formatCountdown(secondsLeft)}
      </span>
      {waiting && (
        <span className="mt-1 inline-flex items-center rounded-full border border-amber-400/45 bg-amber-400/15 px-1.5 py-[1px] text-[8px] font-black uppercase tracking-[0.08em] text-amber-500 dark:text-amber-300">
          Please wait
        </span>
      )}
    </div>
  );
}

interface MatchCardProps {
  theme: Theme;
  match: TournamentMatch;
  joined: boolean;
  onOpen: () => void;
}

export function MatchCard({ theme, match, joined, onOpen }: MatchCardProps) {
  const isDark = theme === 'dark';
  const fillPercent = Math.round((match.filledSlots / match.totalSlots) * 100);
  // Every seat booked and this player is not one of them — no Join CTA.
  const slotsFull = match.filledSlots >= match.totalSlots && !joined;
  // Kickoff passed, the organiser has not started the match yet.
  const awaitingStart = Boolean(match.awaitingStart);
  // Nothing else is joinable once a match is full, live, or waiting to start.
  const cardDisabled = !joined && (slotsFull || Boolean(match.isLive) || awaitingStart);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={cardDisabled ? undefined : onOpen}
      onKeyDown={(event) => {
        if (cardDisabled) return;
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className={cx(
        'rounded-2xl border p-3.5 transition-all',
        cardDisabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5',
        isDark
          ? 'border-white/10 bg-[#0B1526]/85 hover:border-white/20'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-400'
      )}
    >
      {/* Top: number + map + mode chips, live countdown on the right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {match.matchNumber != null && (
            <span className="inline-flex items-center rounded-md bg-[#00C2FF]/15 px-2 py-0.5 text-[11px] font-black text-[#00C2FF]">
              {match.matchNumber}
            </span>
          )}
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold',
              isDark ? 'border-white/10 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <MapPin className="h-2.5 w-2.5 text-[#00C2FF]" />
            {match.map}
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider',
              isDark ? 'border-white/10 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <Gamepad2 className="h-2.5 w-2.5" />
            {match.modeChip ?? match.modeBadge}
          </span>
        </div>
        <MatchCountdown
          iso={match.kickoffIso}
          isLive={match.isLive}
          awaitingStart={awaitingStart}
          isDark={isDark}
        />
      </div>

      {/* Kickoff date + time, directly under the chips row */}
      <p className={cx('mt-1.5 text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
        {match.kickoffIso ? formatKickoffStamp(match.kickoffIso) : match.time}
      </p>

      {/* Delay notice: kept to one small word under the status (owner's rule). */}

      {/* Per-kill / entry stats */}
      <div
        className={cx(
          'mt-2.5 flex items-stretch justify-between rounded-xl border px-3.5 py-2',
          isDark ? 'border-white/5 bg-slate-900/75' : 'border-slate-200 bg-slate-50'
        )}
      >
        <div className="min-w-0">
          <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Per Kill
          </span>
          <span className={cx('inline-flex items-center gap-1 text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-900')}>
            <Crosshair className="h-3 w-3 text-slate-400" />
            {match.perKill ? formatINR(match.perKill) : 'Win Only'}
          </span>
        </div>
        <span aria-hidden className={cx('w-px shrink-0 self-stretch', isDark ? 'bg-white/10' : 'bg-slate-200')} />
        <div className="text-right">
          <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Entry Fee
          </span>
          <span className={cx('text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
            {formatINR(match.entryFee)}
          </span>
        </div>
      </div>

      {/* Slot Fill Bar & Join CTA */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
            <span className={cx('inline-flex items-center gap-1', isDark ? 'text-slate-300' : 'text-slate-700')}>
              <Users className="h-3 w-3 text-slate-400" /> {match.filledSlots}/{match.totalSlots} Slots
            </span>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {slotsFull || match.filledSlots >= match.totalSlots
                ? 'Slot Full'
                : `${match.totalSlots - match.filledSlots} left`}
            </span>
          </div>
          <div className={cx('h-1.5 overflow-hidden rounded-full', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
            <div
              style={{ width: `${fillPercent}%` }}
              className="h-full rounded-full bg-[#00C2FF] shadow-[0_0_8px_rgba(0,194,255,0.65)] transition-all"
            />
          </div>
        </div>

        {/* Action Button */}
        <span
          className={cx(
            'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-[0.96]',
            joined
              ? 'bg-emerald-500 text-white'
              : slotsFull || match.isLive || awaitingStart
                ? 'cursor-not-allowed bg-slate-600 text-slate-200'
                : 'bg-[#FFD000] text-slate-950 hover:bg-[#FFDA29] shadow-sm'
          )}
        >
          {joined ? 'Joined ✓' : slotsFull ? 'Slot Full' : `Join • ${formatINR(match.entryFee)}`}
        </span>
      </div>
    </article>
  );
}
