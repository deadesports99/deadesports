import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Crest } from './components/common/Crest';
import { SessionProvider, useSession } from './context/SessionContext';
import { StepUpProvider } from './context/StepUpContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { AppShell } from './components/navigation/AppShell';
import { AdminLoginScreen } from './screens/auth/AdminLoginScreen';
import { DashboardScreen } from './screens/dashboard/DashboardScreen';
import { MatchesScreen } from './screens/matches/MatchesScreen';
import { ManageMatchesScreen } from './screens/manage/ManageMatchesScreen';
import { CreateMatchScreen } from './screens/matches/CreateMatchScreen';
import { MatchControlScreen } from './screens/matches/MatchControlScreen';
import { MatchPlayersScreen } from './screens/matches/MatchPlayersScreen';
import { FinalPayoutScreen } from './screens/payout/FinalPayoutScreen';
import { WalletScreen } from './screens/wallet/WalletScreen';
import { SettlementScreen } from './screens/wallet/SettlementScreen';
import { PlayersScreen } from './screens/players/PlayersScreen';
import { StaffScreen } from './screens/staff/StaffScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { useTheme } from './lib/theme';
import { cx } from './lib/format';

/** Boot screen while `GET /auth/me` decides between login and shell. */
function SplashScreen({ reconnecting = false }: { reconnecting?: boolean }) {
  const isDark = useTheme() === 'dark';

  return (
    <div
      className={cx(
        'relative flex min-h-screen flex-col items-center justify-center gap-4',
        isDark ? 'bg-[#050B14] text-white' : 'bg-slate-100 text-slate-950'
      )}
    >
      <Crest />
      <div className="text-center">
        <p className="font-spartan text-lg font-black tracking-tight">Spartan Arena</p>
        <p className={cx('mt-1 text-[11.5px] font-bold uppercase tracking-[0.24em]', isDark ? 'text-amber-300' : 'text-amber-800')}>
          Admin Console
        </p>
      </div>
      <Loader2 className={cx('h-5 w-5 animate-spin', 'text-slate-600 dark:text-slate-400')} />
      {reconnecting && (
        <p className={cx('text-[12px] font-semibold', isDark ? 'text-slate-400' : 'text-slate-600')}>
          Reconnecting to the server — your session is safe.
        </p>
      )}
    </div>
  );
}

/**
 * Where to send the admin after sign-in. Kept in sessionStorage because the
 * post-login redirect can happen in a different render pass than the sign-out.
 */
const RETURN_TO_KEY = 'admin:returnTo';

function rememberReturnTo(from: string) {
  if (!from.startsWith('/') || from.startsWith('//') || from === '/login') return;
  try {
    window.sessionStorage.setItem(RETURN_TO_KEY, from);
  } catch {
    /* private mode / storage disabled — fall back to the dashboard */
  }
}

function readReturnTo(): string {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(RETURN_TO_KEY);
  } catch {
    raw = null;
  }
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw === '/login') return '/';
  return raw;
}

function clearReturnTo() {
  try {
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    /* storage disabled */
  }
}

/**
 * Signed-out gate: the login screen always lives at `/login`, and the page the
 * admin was on is remembered so sign-in can return there. Rendering the form on
 * top of `/settings` left a stale URL in the address bar (and reloading it
 * bounced the admin straight back to the sign-in form).
 */
function AnonymousGate() {
  const location = useLocation();

  if (location.pathname === '/login') return <AdminLoginScreen />;

  rememberReturnTo(`${location.pathname}${location.search}`);
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { status, reconnecting } = useSession();
  const location = useLocation();

  // Once the admin is back on a real page, the remembered target is spent.
  useEffect(() => {
    if (location.pathname !== '/login') clearReturnTo();
  }, [location.pathname]);

  if (status === 'loading') return <SplashScreen reconnecting={reconnecting} />;
  if (status === 'anonymous') return <AnonymousGate />;

  // Freshly signed in while sitting on `/login` — go back where they came from.
  if (location.pathname === '/login') return <Navigate to={readReturnTo()} replace />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardScreen />} />

        {/* Phase 4 — match operations (live) */}
        <Route path="matches" element={<MatchesScreen />} />
        <Route path="manage" element={<ManageMatchesScreen />} />
        <Route path="matches/create" element={<CreateMatchScreen />} />
        {/* Publish Room merged into Manage Matches — old links keep working. */}
        <Route path="matches/publish" element={<Navigate to="/manage" replace />} />
        {/* Every joined player, earliest join first — linked from the seats chip. */}
        <Route path="matches/:id/players" element={<MatchPlayersScreen />} />
        <Route path="matches/:id" element={<MatchControlScreen />} />
        {/* Final Payout desk — submitted matches, totals and the OTP payout. */}
        <Route path="payouts" element={<FinalPayoutScreen />} />
        {/* Live Scorer is gone; old bookmarks land on the payout desk. */}
        <Route path="roster" element={<Navigate to="/payouts" replace />} />
        <Route path="scorer" element={<Navigate to="/payouts" replace />} />

        {/* Phase 5 — money, players, staff, settings */}
        <Route path="wallet" element={<WalletScreen />} />
        <Route path="wallet/settlement" element={<SettlementScreen />} />
        <Route path="players" element={<PlayersScreen />} />
        <Route path="players/watchlist" element={<PlayersScreen />} />
        <Route path="players/devices" element={<PlayersScreen />} />
        <Route path="players/suspicious" element={<PlayersScreen />} />
        <Route path="players/:id" element={<PlayersScreen />} />
        <Route path="staff" element={<StaffScreen />} />
        <Route path="settings" element={<SettingsScreen />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/**
 * Provider order matters:
 *   Toast (UI) → Session (cookie) → Step-up (needs the toast) → Realtime → Router.
 */
export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <StepUpProvider>
            <RealtimeProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </RealtimeProvider>
          </StepUpProvider>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
