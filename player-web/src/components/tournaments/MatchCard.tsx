import React from 'react';
import { Crosshair, Gamepad2, MapPin, Users } from 'lucide-react';
import { Theme, TournamentMatch } from '../../types';
import { cx, formatINR } from '../../utils/formatters';

interface MatchCardProps {
  theme: Theme;
  match: TournamentMatch;
  joined: boolean;
  onOpen: () => void;
}

export function MatchCard({ theme, match, joined, onOpen }: MatchCardProps) {
  const isDark = theme === 'dark';
  const fillPercent = Math.round((match.filledSlots / match.totalSlots) * 100);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className={cx(
        'cursor-pointer rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5',
        isDark
          ? 'border-white/10 bg-[#0B1526]/85 hover:border-white/20'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-400'
      )}
    >
      {/* Top Map & Time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
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
            {match.modeBadge}
          </span>
        </div>
        <span className={cx('shrink-0 text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
          {match.time}
        </span>
      </div>

      {/* Match Title */}
      <p className={cx('mt-2 text-[13px] font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
        {match.title}
      </p>

      {/* 3-Column Prize / Kill / Entry Stats */}
      <div
        className={cx(
          'mt-2.5 grid grid-cols-3 gap-2 rounded-xl border px-3 py-2',
          isDark ? 'border-white/5 bg-slate-900/75' : 'border-slate-200 bg-slate-50'
        )}
      >
        <div>
          <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Prize Pool
          </span>
          <span className={cx('text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
            {formatINR(match.prizePool)}
          </span>
        </div>
        <div className={cx('border-x px-2', isDark ? 'border-white/10' : 'border-slate-200')}>
          <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Per Kill
          </span>
          <span className={cx('inline-flex items-center gap-1 text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-900')}>
            <Crosshair className="h-3 w-3 text-slate-400" />
            {match.perKill ? formatINR(match.perKill) : 'Win Only'}
          </span>
        </div>
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
              {match.totalSlots - match.filledSlots} left
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
              : 'bg-[#FFD000] text-slate-950 hover:bg-[#FFDA29] shadow-sm'
          )}
        >
          {joined ? 'Joined ✓' : `Join • ${formatINR(match.entryFee)}`}
        </span>
      </div>
    </article>
  );
}
