import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface ThemeButtonProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeButton({ theme, onToggle }: ThemeButtonProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle color theme"
      className={cx(
        'group fixed right-4 top-3.5 z-[70] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide backdrop-blur-xl transition-all active:scale-95 shadow-sm',
        isDark
          ? 'border border-white/15 bg-slate-900/85 text-slate-100 shadow-black/40 hover:border-white/30'
          : 'border border-slate-300 bg-white/95 text-slate-950 hover:border-slate-500'
      )}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform group-hover:rotate-45" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-slate-700 transition-transform group-hover:-rotate-12" />
      )}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
