import { Loader2 } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface LoadingStateProps {
  label?: string;
  rows?: number;
  className?: string;
}

/** Skeleton rows — layout does not jump when the data lands. */
export function LoadingState({ label = 'Loading…', rows = 4, className }: LoadingStateProps) {
  const isDark = useTheme() === 'dark';

  return (
    <div className={cx('space-y-2.5', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cx(
            'flex animate-pulse items-center gap-3 rounded-xl border p-3.5',
            isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
          )}
        >
          <div className={cx('h-9 w-9 shrink-0 rounded-lg', isDark ? 'bg-white/10' : 'bg-slate-200')} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={cx('h-3 w-1/3 rounded', isDark ? 'bg-white/10' : 'bg-slate-200')} />
            <div className={cx('h-2.5 w-2/3 rounded', isDark ? 'bg-white/[0.07]' : 'bg-slate-100')} />
          </div>
          <div className={cx('h-7 w-16 rounded-lg', isDark ? 'bg-white/[0.07]' : 'bg-slate-100')} />
        </div>
      ))}
      <p className={cx('flex items-center justify-center gap-1.5 pt-1 text-[11px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
        <Loader2 className="h-3 w-3 animate-spin" /> {label}
      </p>
    </div>
  );
}
