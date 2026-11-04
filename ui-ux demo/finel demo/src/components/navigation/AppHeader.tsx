import React from 'react';
import { Wallet, Settings } from 'lucide-react';
import { Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { Crest } from '../common/Crest';

interface AppHeaderProps {
  theme: Theme;
  title?: string;
  subtitle?: string;
  balance: number;
  onAddFunds: () => void;
  onNotify?: () => void;
  onSettings?: () => void;
}

export function AppHeader({
  theme,
  balance,
  onAddFunds,
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
      {/* Top Left: App Logo + App Name */}
      <div className="flex items-center gap-2.5">
        <Crest small />
        <span
          className={cx(
            'text-[15px] font-black tracking-tight leading-none',
            isDark ? 'text-white' : 'text-slate-950'
          )}
        >
          Spartan Arena
        </span>
      </div>

      {/* Top Right: Settings (if present) + Clean Wallet Badge without + or notifications */}
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

        {/* Clean Wallet Balance Pill (Clickable) */}
        <button
          type="button"
          onClick={onAddFunds}
          aria-label="Open Wallet"
          className={cx(
            'flex h-8 items-center gap-2 rounded-lg border px-3 transition-all active:scale-95',
            isDark
              ? 'border-white/15 bg-[#0B1526] text-white hover:border-white/30'
              : 'border-slate-300 bg-white text-slate-950 shadow-sm hover:border-slate-400'
          )}
        >
          <Wallet className={cx('h-3.5 w-3.5 shrink-0', isDark ? 'text-slate-300' : 'text-slate-700')} />
          <span className={cx('text-xs font-black tracking-tight leading-none', isDark ? 'text-white' : 'text-slate-950')}>
            {formatINR(balance)}
          </span>
        </button>
      </div>
    </header>
  );
}
