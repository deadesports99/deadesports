import React from 'react';
import { Bell, Plus, Settings, Wallet } from 'lucide-react';
import { Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { Crest } from '../common/Crest';

interface AppHeaderProps {
  theme: Theme;
  title: string;
  subtitle: string;
  balance: number;
  onAddFunds: () => void;
  onNotify: () => void;
  onSettings?: () => void;
}

export function AppHeader({
  theme,
  title,
  subtitle,
  balance,
  onAddFunds,
  onNotify,
  onSettings,
}: AppHeaderProps) {
  const isDark = theme === 'dark';

  return (
    <header
      className={cx(
        'sticky top-0 z-20 flex items-center justify-between border-b px-4 pb-3 pt-3.5 backdrop-blur-xl transition-colors',
        isDark ? 'border-white/10 bg-slate-950/85' : 'border-slate-200 bg-white/95 shadow-sm'
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Crest small />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1
              className={cx(
                'truncate text-[13px] font-black uppercase tracking-wider',
                isDark ? 'text-white' : 'text-slate-950'
              )}
            >
              {title}
            </h1>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
          </div>
          <p className={cx('truncate text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onSettings && (
          <button
            type="button"
            aria-label="Open Settings"
            onClick={onSettings}
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95',
              isDark
                ? 'border-white/10 bg-[#0B1526]/80 text-slate-300 hover:text-white'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-950'
            )}
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          aria-label="Notifications"
          onClick={onNotify}
          className={cx(
            'relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95',
            isDark
              ? 'border-white/10 bg-[#0B1526]/80 text-slate-300 hover:text-white'
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-950'
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FFD000]" />
        </button>

        {/* Balance badge with quick add */}
        <div
          className={cx(
            'flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1 py-1 transition-all',
            isDark
              ? 'border-white/15 bg-[#0B1526] text-white'
              : 'border-slate-300 bg-white text-slate-950 shadow-sm'
          )}
        >
          <Wallet className={cx('h-3 w-3', isDark ? 'text-amber-400' : 'text-slate-700')} />
          <span className={cx('text-xs font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
            {formatINR(balance)}
          </span>
          <button
            type="button"
            onClick={onAddFunds}
            aria-label="Add funds"
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[#FFD000] text-slate-950 transition-all hover:bg-[#FFDA29] active:scale-90"
          >
            <Plus className="h-3 w-3 stroke-[3]" />
          </button>
        </div>
      </div>
    </header>
  );
}
