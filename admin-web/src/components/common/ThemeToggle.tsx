import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

/** Dark/light switch — identical to the player app's header control. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95',
        isDark
          ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white'
          : 'border-slate-300 bg-white text-slate-600 shadow-sm hover:text-slate-950',
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
