import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

type Tone = 'gold' | 'cyan' | 'rose' | 'emerald' | 'slate';

interface StatPillProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

const TONE: Record<Tone, { dark: string; light: string }> = {
  gold: { dark: 'text-amber-300 bg-amber-400/10 border-amber-400/20', light: 'text-amber-700 bg-amber-50 border-amber-200' },
  cyan: { dark: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20', light: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  rose: { dark: 'text-rose-300 bg-rose-400/10 border-rose-400/20', light: 'text-rose-700 bg-rose-50 border-rose-200' },
  emerald: { dark: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20', light: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  slate: { dark: 'text-slate-300 bg-white/[0.06] border-white/10', light: 'text-slate-700 bg-slate-100 border-slate-200' },
};

/**
 * "Aaj ka kaam" tile. Whole tile is the hit area (>= 44px) and shows a chevron
 * when it leads somewhere.
 */
export function StatPill({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
  onClick,
  loading,
  className,
}: StatPillProps) {
  const isDark = useTheme() === 'dark';
  const interactive = Boolean(onClick);

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-lg border',
            isDark ? TONE[tone].dark : TONE[tone].light
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {interactive && (
          <ChevronRight
            className={cx(
              'h-4 w-4 transition-transform group-hover:translate-x-0.5',
              isDark ? 'text-slate-500' : 'text-slate-400'
            )}
          />
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div
            className={cx(
              'h-6 w-16 animate-pulse rounded',
              isDark ? 'bg-white/10' : 'bg-slate-200'
            )}
          />
        ) : (
          <p
            className={cx(
              'text-xl font-black leading-none tracking-tight sm:text-2xl',
              isDark ? 'text-white' : 'text-slate-950'
            )}
          >
            {value}
          </p>
        )}
        <p
          className={cx(
            'mt-1.5 text-[11px] font-bold leading-tight',
            isDark ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          {label}
        </p>
        {hint && (
          <p className={cx('mt-0.5 text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>{hint}</p>
        )}
      </div>
    </>
  );

  const shell = cx(
    'group w-full rounded-2xl border p-3 text-left transition-all sm:p-3.5',
    isDark
      ? 'border-white/[0.08] bg-[#0C121E]/85 backdrop-blur-xl hover:border-white/20'
      : 'border-slate-200 bg-white shadow-sm hover:border-slate-300',
    interactive && 'active:scale-[0.99]',
    className
  );

  if (!interactive) return <div className={shell}>{content}</div>;

  return (
    <button type="button" onClick={onClick} className={shell}>
      {content}
    </button>
  );
}
