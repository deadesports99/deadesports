import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { accessForPath, can } from '../../lib/permissions';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Ambient } from '../common/Ambient';
import { useToast } from '../common/Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Sidebar, MobileDrawer } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';

/**
 * Authenticated layout.
 *
 * Desktop: fixed sidebar + content. Tablet: icon rail. Phone: top bar, drawer
 * and bottom nav. The content column never scrolls horizontally at any width.
 */
export function AppShell() {
  const isDark = useTheme() === 'dark';
  const { user, signOut } = useSession();
  const toast = useToast();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const required = accessForPath(location.pathname);
  const allowed = can(user, required);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Explain the redirect instead of silently bouncing the user.
  useEffect(() => {
    if (!allowed) {
      toast.error('Your account does not have access to that screen');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className={cx('relative min-h-screen', isDark ? 'bg-[#050B14]' : 'bg-slate-100')}>
      <Ambient />

      <Sidebar onLogout={() => setLogoutOpen(true)} />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLogout={() => {
          setDrawerOpen(false);
          setLogoutOpen(true);
        }}
      />

      <div className="relative z-10 md:pl-20 lg:pl-[264px]">
        <TopBar onMenu={() => setDrawerOpen(true)} />

        <main className="mx-auto w-full max-w-[1500px] px-3 pb-24 pt-4 sm:px-5 sm:pb-10 sm:pt-5 lg:px-7">
          <Outlet />
        </main>
      </div>

      <BottomNav onMore={() => setDrawerOpen(true)} />

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out of the admin console?"
        description="The httpOnly session cookie is cleared on the server. You will need the owner email, permission key and a fresh OTP to sign back in."
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setLogoutOpen(false);
          void signOut();
        }}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  );
}
