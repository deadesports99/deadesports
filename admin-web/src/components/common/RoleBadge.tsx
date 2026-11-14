import { Crown, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import type { AdminUser } from '../../types';

/** OWNER (ADMIN) vs STAFF (SUB_ADMIN) — same chip in the sidebar and top bar. */
export function RoleBadge({ user, compact = false }: { user: AdminUser | null; compact?: boolean }) {
  const isDark = useTheme() === 'dark';
  const owner = user?.role === 'ADMIN';
  const Icon = owner ? Crown : ShieldCheck;

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
        owner
          ? isDark
            ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
            : 'border-amber-300 bg-amber-50 text-amber-700'
          : isDark
            ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
            : 'border-cyan-300 bg-cyan-50 text-cyan-700'
      )}
      title={owner ? 'Owner — full access' : 'Staff — permission key session'}
    >
      <Icon className="h-2.5 w-2.5" />
      {!compact && (owner ? 'Owner' : 'Staff')}
    </span>
  );
}
