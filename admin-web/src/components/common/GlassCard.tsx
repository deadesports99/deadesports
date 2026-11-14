import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface GlassCardProps {
  className?: string;
  children: ReactNode;
  /** Flat panels skip the blur (dense tables perform better). */
  flat?: boolean;
}

/** The one card surface used everywhere in the console. */
export function GlassCard({ className, children, flat = false }: GlassCardProps) {
  const isDark = useTheme() === 'dark';

  return (
    <div
      className={cx(
        'rounded-2xl border transition-colors',
        flat
          ? isDark
            ? 'border-white/[0.08] bg-[#0B1526]'
            : 'border-slate-200 bg-white'
          : isDark
            ? 'border-white/[0.08] bg-[#0C121E]/85 shadow-xl shadow-black/40 backdrop-blur-xl'
            : 'border-slate-200 bg-white/95 shadow-md shadow-slate-300/40 backdrop-blur-md',
        className
      )}
    >
      {children}
    </div>
  );
}
