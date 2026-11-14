import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

/** Small building blocks shared by Create Match, Publish Room and the dialogs. */

export function Chip({
  active = false,
  onClick,
  children,
  disabled = false,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const isDark = useTheme() === 'dark';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-[#FFD000]/60 bg-[#FFD000]/15 text-amber-500'
          : isDark
            ? 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950',
        className
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const isDark = useTheme() === 'dark';

  return (
    <label className={cx('block', className)}>
      <span
        className={cx(
          'mb-1 block text-[10px] font-black uppercase tracking-[0.14em]',
          isDark ? 'text-slate-500' : 'text-slate-500'
        )}
      >
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-rose-400">{error}</span>
      ) : hint ? (
        <span className={cx('mt-1 block text-[11px]', isDark ? 'text-slate-500' : 'text-slate-500')}>{hint}</span>
      ) : null}
    </label>
  );
}

const controlClasses = (isDark: boolean) =>
  cx(
    'h-11 w-full rounded-xl border px-3 text-[13px] font-semibold outline-none transition-colors focus:border-[#FFD000]/70 focus:ring-2 focus:ring-[#FFD000]/20 sm:h-10',
    isDark
      ? 'border-white/10 bg-[#060B14] text-white placeholder:text-slate-600'
      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400'
  );

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const isDark = useTheme() === 'dark';
  return <input {...rest} className={cx(controlClasses(isDark), className)} />;
}

export function SelectField({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const isDark = useTheme() === 'dark';
  return (
    <select {...rest} className={cx(controlClasses(isDark), 'cursor-pointer', className)}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const isDark = useTheme() === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
        isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
      )}
    >
      <span
        className={cx(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors',
          checked ? 'border-emerald-400/50 bg-emerald-400/30' : isDark ? 'border-white/15 bg-white/10' : 'border-slate-300 bg-slate-200'
        )}
      >
        <span
          className={cx(
            'h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
      <span className="min-w-0">
        <span className={cx('block text-[12px] font-bold', isDark ? 'text-slate-100' : 'text-slate-900')}>{label}</span>
        {hint && (
          <span className={cx('mt-0.5 block text-[11px] leading-snug', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  const isDark = useTheme() === 'dark';
  return (
    <p
      role="alert"
      className={cx(
        'rounded-xl border px-3 py-2 text-[12px] font-semibold',
        isDark ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'
      )}
    >
      {children}
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  const isDark = useTheme() === 'dark';
  return (
    <p
      className={cx(
        'rounded-xl border px-3 py-2 text-[11px] leading-relaxed',
        isDark ? 'border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200' : 'border-cyan-200 bg-cyan-50 text-cyan-800'
      )}
    >
      {children}
    </p>
  );
}
