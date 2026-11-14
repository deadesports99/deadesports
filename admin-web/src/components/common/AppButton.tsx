import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cyan';
type Size = 'sm' | 'md' | 'lg';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Primary action button — gold is the "do it" colour (same #FFD000 as the app).
 * Touch targets stay >= 44px on small screens.
 */
export function AppButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: AppButtonProps) {
  const isDark = useTheme() === 'dark';

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold tracking-tight transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

  const sizes: Record<Size, string> = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-11 px-4 text-[13px] sm:h-10',
    lg: 'h-12 px-5 text-sm',
  };

  const variants: Record<Variant, string> = {
    primary: 'bg-[#FFD000] text-slate-950 shadow-md shadow-amber-400/20 hover:bg-[#FFDA29]',
    secondary: isDark
      ? 'border border-white/15 bg-white/[0.04] text-slate-100 hover:border-white/30 hover:bg-white/[0.08]'
      : 'border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50',
    ghost: isDark
      ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
      : 'text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-950',
    danger: isDark
      ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
      : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    cyan: isDark
      ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
      : 'border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100',
  };

  return (
    <button
      type="button"
      className={cx(base, sizes[size], variants[variant], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
