import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { NAV_GROUPS, can } from '../../lib/permissions';
import { useTheme } from '../../lib/theme';
import { cx, initialsOf } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Crest } from '../common/Crest';
import { RoleBadge } from '../common/RoleBadge';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
  onClose?: () => void;
}

/**
 * Navigation body, shared by the fixed desktop sidebar and the mobile drawer.
 * Only permitted destinations render — revoking a permission removes the row
 * on the next session refresh, no reload needed.
 */
function NavContent({ collapsed = false, onNavigate, onLogout, onClose }: NavContentProps) {
  const isDark = useTheme() === 'dark';
  const { user } = useSession();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand */}
      <div className={cx('flex items-center gap-3 px-3 pb-4 pt-5', collapsed && 'justify-center px-2')}>
        <Crest small />
        {!collapsed && (
          <div className="min-w-0">
            <p className={cx('truncate font-display text-sm font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
              Spartan Arena
            </p>
            <p className={cx('text-[10px] font-bold uppercase tracking-[0.18em]', isDark ? 'text-slate-500' : 'text-slate-500')}>
              Admin Console
            </p>
          </div>
        )}
        {!collapsed && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={cx(
              'ml-auto flex h-9 w-9 items-center justify-center rounded-xl border md:hidden',
              isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Groups */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Admin sections">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => can(user, item.access));
          if (!items.length) return null;

          return (
            <div key={group.id} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className={cx('mb-1.5 px-2.5 text-[9px] font-black uppercase tracking-[0.2em]', isDark ? 'text-slate-600' : 'text-slate-400')}>
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {items.map(({ to, label, icon: Icon, phase }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        cx(
                          'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[12.5px] font-bold transition-all',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? isDark
                              ? 'bg-white/[0.08] text-white'
                              : 'bg-slate-900 text-white shadow-sm'
                            : isDark
                              ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cx(
                              'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity',
                              isActive ? 'bg-[#FFD000] opacity-100' : 'opacity-0'
                            )}
                            aria-hidden="true"
                          />
                          <Icon className={cx('h-[17px] w-[17px] shrink-0', isActive ? 'stroke-[2.2]' : 'stroke-[1.8]')} />
                          {!collapsed && (
                            <>
                              <span className="truncate">{label}</span>
                              {phase && (
                                <span
                                  className={cx(
                                    'ml-auto rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider',
                                    isDark
                                      ? 'border-white/10 text-slate-500'
                                      : 'border-slate-200 text-slate-400'
                                  )}
                                >
                                  P{phase}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Account footer */}
      <div className={cx('border-t px-2.5 py-3', isDark ? 'border-white/[0.07]' : 'border-slate-200')}>
        <div className={cx('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black',
              isDark
                ? 'border-white/10 bg-white/[0.05] text-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-700'
            )}
          >
            {initialsOf(user?.name ?? user?.email, 'AD')}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className={cx('truncate text-[12px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
                {user?.name ?? 'Admin'}
              </p>
              <p className={cx('truncate text-[10px]', isDark ? 'text-slate-500' : 'text-slate-500')}>
                {user?.email ?? user?.phoneNumber ?? ''}
              </p>
            </div>
          )}

          {!collapsed && <RoleBadge user={user} compact />}
        </div>

        <div className={cx('mt-3 flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <ThemeToggle className={collapsed ? 'h-8 w-8' : undefined} />
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className={cx(
              'flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95',
              collapsed ? 'w-8' : 'flex-1 px-2.5',
              isDark
                ? 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-rose-400/40 hover:text-rose-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600'
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fixed sidebar: full on desktop (≥1024px), icon rail on tablet (768–1023px). */
export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const isDark = useTheme() === 'dark';

  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r md:flex lg:w-[264px]',
        isDark ? 'border-white/[0.07] bg-[#070E1A]/95 backdrop-blur-xl' : 'border-slate-200 bg-white/95 backdrop-blur-xl'
      )}
    >
      <div className="lg:hidden">
        <NavContent collapsed onLogout={onLogout} />
      </div>
      <div className="hidden lg:block">
        <NavContent onLogout={onLogout} />
      </div>
    </aside>
  );
}

/** Slide-in drawer for phones (<768px). */
export function MobileDrawer({
  open,
  onClose,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const isDark = useTheme() === 'dark';
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <aside
        className={cx(
          'relative h-full w-[80%] max-w-[300px] border-r shadow-2xl animate-drawer',
          isDark ? 'border-white/10 bg-[#070E1A]' : 'border-slate-200 bg-white'
        )}
      >
        <NavContent onNavigate={onClose} onClose={onClose} onLogout={onLogout} />
      </aside>
    </div>
  );
}
