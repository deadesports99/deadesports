import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw } from 'lucide-react';
import { NAV_GROUPS } from '../../lib/permissions';
import { useTheme } from '../../lib/theme';
import { cx, istClock } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { useRealtime } from '../../context/RealtimeContext';
import { Crest } from '../common/Crest';
import { RoleBadge } from '../common/RoleBadge';
import { ThemeToggle } from '../common/ThemeToggle';

/** Page title fallback for routes that are not in the nav (e.g. create match). */
const EXTRA_TITLES: Array<{ test: RegExp; title: string }> = [
  { test: /^\/matches\/create/, title: 'Create Match' },
  { test: /^\/matches\/publish/, title: 'Publish Room' },
  { test: /^\/matches\/[^/]+/, title: 'Match Details' },
  { test: /^\/players\/[^/]+/, title: 'Player Detail' },
  { test: /^\/players\/watchlist/, title: 'Watchlist' },
  { test: /^\/players\/devices/, title: 'Device Groups' },
  { test: /^\/players\/suspicious/, title: 'Suspicious Players' },
  { test: /^\/staff/, title: 'Staff & Access' },
  { test: /^\/settings/, title: 'App Settings' },
];

/**
 * Sticky top bar: section title, live IST clock, realtime state, manual refresh
 * and the theme toggle. On phones the drawer button replaces the sidebar.
 */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const isDark = useTheme() === 'dark';
  const { user } = useSession();
  const { status, refresh } = useRealtime();
  const location = useLocation();
  const [clock, setClock] = useState(() => istClock());
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(istClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const title = useMemo(() => {
    const flat = NAV_GROUPS.flatMap((group) => group.items);
    const exact = flat.find((item) => item.to === location.pathname);
    if (exact) return exact.label;
    const startsWith = flat
      .filter((item) => item.to !== '/' && location.pathname.startsWith(item.to))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (startsWith) return startsWith.label;
    return EXTRA_TITLES.find((entry) => entry.test.test(location.pathname))?.title ?? 'Dashboard';
  }, [location.pathname]);

  const doRefresh = () => {
    refresh();
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <header
      className={cx(
        'sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-xl sm:px-4 md:h-16',
        isDark ? 'border-white/[0.07] bg-[#050B14]/85' : 'border-slate-200 bg-white/90'
      )}
    >
      {/* Mobile: menu + crest; desktop keeps the sidebar brand */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border md:hidden',
          isDark ? 'border-white/10 bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-white text-slate-600'
        )}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <Crest small className="!h-9 !w-9" />
      </div>

      <div className="min-w-0 flex-1">
        <h1
          className={cx(
            'truncate text-[15px] font-black tracking-tight sm:text-base',
            isDark ? 'text-white' : 'text-slate-950'
          )}
        >
          {title}
        </h1>
        <p className={cx('hidden text-[10px] font-medium sm:block', isDark ? 'text-slate-500' : 'text-slate-500')}>
          {clock}
        </p>
      </div>

      {/* Realtime dot + role (desktop) */}
      <div className="hidden items-center gap-2 sm:flex">
        <span
          title={
            status === 'open'
              ? 'Realtime connected'
              : status === 'connecting'
                ? 'Connecting to realtime…'
                : 'Realtime offline — refresh manually'
          }
          className={cx(
            'h-2 w-2 rounded-full',
            status === 'open' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-rose-500'
          )}
        />
        <RoleBadge user={user} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cx(
            'hidden rounded-lg border px-2 py-1 font-mono text-[10px] font-bold xl:block',
            isDark ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
          )}
        >
          {clock}
        </span>

        <button
          type="button"
          onClick={doRefresh}
          aria-label="Refresh data"
          title="Refresh"
          className={cx(
            'flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95',
            isDark
              ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:text-slate-950'
          )}
        >
          <RefreshCw className={cx('h-4 w-4', spinning && 'animate-spin')} />
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
