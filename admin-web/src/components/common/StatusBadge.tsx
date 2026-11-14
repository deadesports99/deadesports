import { useTheme } from '../../lib/theme';
import { cx, humanize } from '../../lib/format';

type Tone = 'live' | 'scheduled' | 'review' | 'done' | 'cancelled' | 'neutral' | 'pending' | 'approved' | 'rejected';

const TONE_BY_STATUS: Record<string, Tone> = {
  DRAFT: 'neutral',
  UPCOMING: 'scheduled',
  OPEN: 'scheduled',
  SLOTS_FULL: 'pending',
  ROOM_REVEALED: 'live',
  LIVE: 'live',
  UNDER_REVIEW: 'review',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  className?: string;
}

/** Small state pill (match status, payment status, key status …). */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const isDark = useTheme() === 'dark';
  const tone = TONE_BY_STATUS[(status ?? '').toUpperCase()] ?? 'neutral';

  const darkTones: Record<Tone, string> = {
    live: 'border-rose-400/35 bg-rose-500/15 text-rose-300',
    scheduled: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
    review: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    done: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    pending: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    approved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    rejected: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
    neutral: 'border-white/15 bg-white/[0.05] text-slate-300',
  };

  const lightTones: Record<Tone, string> = {
    live: 'border-rose-200 bg-rose-50 text-rose-700',
    scheduled: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    review: 'border-amber-200 bg-amber-50 text-amber-700',
    done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
        isDark ? darkTones[tone] : lightTones[tone],
        className
      )}
    >
      {tone === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label ?? humanize(status)}
    </span>
  );
}
