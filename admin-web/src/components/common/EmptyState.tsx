import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Honest empty state — always says what to do next. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  const isDark = useTheme() === 'dark';

  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <span
        className={cx(
          'flex h-12 w-12 items-center justify-center rounded-2xl border',
          isDark ? 'border-white/10 bg-white/[0.04] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className={cx('mt-3 text-sm font-black', isDark ? 'text-white' : 'text-slate-950')}>{title}</p>
      {description && (
        <p className={cx('mt-1 max-w-sm text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
