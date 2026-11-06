import React from 'react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface GlassCardProps {
  theme: Theme;
  className?: string;
  children: React.ReactNode;
}

export function GlassCard({ theme, className, children }: GlassCardProps) {
  return (
    <div
      className={cx(
        'border transition-colors',
        theme === 'dark'
          ? 'border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40'
          : 'border-slate-200 bg-white/95 backdrop-blur-md shadow-md shadow-slate-200/50',
        className
      )}
    >
      {children}
    </div>
  );
}
