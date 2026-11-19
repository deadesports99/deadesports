import React from 'react';
import { Crosshair, Swords, Target, Trophy } from 'lucide-react';
import { MyMatchesSummary as Summary, Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';

interface MyMatchesSummaryProps {
  theme: Theme;
  summary: Summary;
}

/** Four career tiles above the history list — the same numbers as the Profile stats. */
export function MyMatchesSummaryStrip({ theme, summary }: MyMatchesSummaryProps) {
  const isDark = theme === 'dark';
  const tiles = [
    { key: 'played', label: 'Played', value: String(summary.matchesPlayed), icon: Swords },
    { key: 'booyah', label: 'Booyah', value: String(summary.booyahs), icon: Trophy },
    { key: 'kills', label: 'Kills', value: String(summary.totalKills), icon: Crosshair },
    { key: 'won', label: 'Won', value: formatINR(summary.totalWinnings), icon: Target },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {tiles.map(({ key, label, value, icon: Icon }) => (
        <div
          key={key}
          className={cx(
            'rounded-xl border px-2 py-2 text-center',
            isDark ? 'border-white/10 bg-[#0B1526]/85' : 'border-slate-200 bg-white shadow-sm'
          )}
        >
          <Icon className={cx('mx-auto h-3 w-3', isDark ? 'text-slate-400' : 'text-slate-500')} />
          <span className={cx('mt-1 block truncate text-[11px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
            {value}
          </span>
          <span className={cx('block text-[8px] font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
