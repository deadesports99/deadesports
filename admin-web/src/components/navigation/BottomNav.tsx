import { NavLink } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { allowedNav } from '../../lib/permissions';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import { useSession } from '../../context/SessionContext';

interface BottomNavProps {
  onMore: () => void;
}

/**
 * Phone navigation (md:hidden). Shows up to four permitted destinations plus
 * "More", which opens the full drawer (logout + owner-only screens).
 */
export function BottomNav({ onMore }: BottomNavProps) {
  const isDark = useTheme() === 'dark';
  const { user } = useSession();

  const tabs = allowedNav(user).filter((item) => item.mobile).slice(0, 4);

  return (
    <nav
      aria-label="Bottom navigation"
      className={cx(
        'fixed inset-x-0 bottom-0 z-40 border-t pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-2xl md:hidden',
        isDark ? 'border-white/10 bg-[#070E1A]/95 shadow-2xl shadow-black' : 'border-slate-900/10 bg-white/95 shadow-xl'
      )}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map(({ to, label, shortLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="group flex flex-1 flex-col items-center justify-center gap-1 py-1 active:scale-95"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cx(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'bg-white/15 text-white'
                        : 'border border-slate-900/10 bg-slate-900/10 text-slate-950'
                      : isDark
                        ? 'text-slate-400 group-hover:text-slate-200'
                        : 'text-slate-500 group-hover:text-slate-800'
                  )}
                >
                  <Icon className={cx('h-5 w-5', isActive ? 'stroke-[2.3]' : 'stroke-[1.8]')} />
                </span>
                <span
                  className={cx(
                    'text-[10px] tracking-tight',
                    isActive
                      ? isDark
                        ? 'font-black text-white'
                        : 'font-black text-slate-950'
                      : isDark
                        ? 'font-medium text-slate-400'
                        : 'font-medium text-slate-500'
                  )}
                >
                  {shortLabel ?? label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={onMore}
          className="group flex flex-1 flex-col items-center justify-center gap-1 py-1 active:scale-95"
        >
          <span
            className={cx(
              'flex h-8 w-14 items-center justify-center rounded-full',
              isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-800'
            )}
          >
            <LayoutGrid className="h-5 w-5 stroke-[1.8]" />
          </span>
          <span className={cx('text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
