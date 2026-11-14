import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  eyebrow?: string;
}

/** Section title row — keeps every screen's rhythm identical. */
export function SectionHeader({ title, subtitle, action, className, eyebrow }: SectionHeaderProps) {
  const isDark = useTheme() === 'dark';

  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={cx(
              'mb-1 text-[10px] font-black uppercase tracking-[0.18em]',
              isDark ? 'text-cyan-400/80' : 'text-cyan-700'
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={cx(
            'text-base font-black tracking-tight sm:text-lg',
            isDark ? 'text-white' : 'text-slate-950'
          )}
        >
          {title}
        </h2>
        {subtitle && (
          <p className={cx('mt-0.5 text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
