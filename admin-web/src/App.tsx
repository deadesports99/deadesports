import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Crest } from './components/common/Crest';
import { SessionProvider, useSession } from './context/SessionContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { AppShell } from './components/navigation/AppShell';
import { AdminLoginScreen } from './screens/auth/AdminLoginScreen';
import { DashboardScreen } from './screens/dashboard/DashboardScreen';
import { MatchesScreen } from './screens/matches/MatchesScreen';
import { CreateMatchScreen } from './screens/matches/CreateMatchScreen';
import { PublishRoomScreen } from './screens/matches/PublishRoomScreen';
import { MatchControlScreen } from './screens/matches/MatchControlScreen';
import { ScorerPickerScreen } from './screens/matches/ScorerPickerScreen';
import { WalletScreen } from './screens/wallet/WalletScreen';
import { SettlementScreen } from './screens/wallet/SettlementScreen';
import { PlayersScreen } from './screens/players/PlayersScreen';
import { StaffScreen } from './screens/staff/StaffScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { useTheme } from './lib/theme';
import { cx } from './lib/format';

/** Boot screen while `GET /auth/me` decides between login and shell. */
function SplashScreen() {
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
        <p className={cx('mt-1 text-[10px] font-bold uppercase tracking-[0.24em]', isDark ? 'text-amber-300' : 'text-amber-600')}>
          Admin Console
        </p>
      </div>
      <Loader2 className={cx('h-5 w-5 animate-spin', isDark ? 'text-slate-500' : 'text-slate-400')} />
    </div>
  );
}

function AppRoutes() {
  const { status } = useSession();

  if (status === 'loading') return <SplashScreen />;
  if (status === 'anonymous') return <AdminLoginScreen />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardScreen />} />

        {/* Phase 4 — match operations (live) */}
        <Route path="matches" element={<MatchesScreen />} />
        <Route path="matches/create" element={<CreateMatchScreen />} />
        <Route path="matches/publish" element={<PublishRoomScreen />} />
        <Route path="matches/:id" element={<MatchControlScreen />} />
        <Route path="roster" element={<ScorerPickerScreen />} />
        <Route path="scorer" element={<Navigate to="/roster" replace />} />

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
 *   Toast (UI) → Session (cookie) → Realtime (needs a session) → Router.
 */
export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <RealtimeProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppRoutes />
            </BrowserRouter>
          </RealtimeProvider>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
