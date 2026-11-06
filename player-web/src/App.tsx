import { useState, useEffect } from 'react';
import {
  Theme,
  AuthStep,
  NavTab,
  FilterCategory,
  WalletMode,
  TxFilter,
  AuthProvider,
  UserProfile,
  TournamentMatch,
  TransactionItem,
} from './types';
import {
  INITIAL_TRANSACTIONS,
} from './data/mockData';
import { generateUTR } from './utils/formatters';
import { api, ApiError, DEV_AUTH, getStoredUser } from './lib/api';
import { isFeedMatch, isJoinClosed, toMatch } from './lib/mappers';

// Common Components
import { Ambient } from './components/common/Ambient';
import { Toast } from './components/common/Toast';

// Navigation
import { AppHeader } from './components/navigation/AppHeader';
import { BottomNav } from './components/navigation/BottomNav';

// Modals & Sheets
import { MatchSheet } from './components/tournaments/MatchSheet';
import { SettingsSheet } from './components/modals/SettingsSheet';
import { SignOutModal } from './components/modals/SignOutModal';

// Screens
import { LoginScreen } from './screens/auth/LoginScreen';
import { OtpScreen } from './screens/auth/OtpScreen';
import { TournamentsScreen } from './screens/TournamentsScreen';
import { WalletScreen } from './screens/WalletScreen';
import { SettingsScreen } from './screens/SettingsScreen';

/** Sent to the backend as the Firebase token in local/dev builds. */
function toPhone(identifier: string): string {
  return identifier.replace(/\D/g, '').slice(-10);
}

export function App() {
  const [step, setStep] = useState<AuthStep>('LOGIN');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#050B14';
      document.body.style.color = '#F8FAFC';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F8FAFC';
      document.body.style.color = '#0F172A';
    }
  }, [theme]);
  const [user, setUser] = useState<UserProfile>(() => {
    const stored = getStoredUser();
    return {
      name: stored?.name ?? stored?.inGameName ?? 'Spartan Player',
      identifier: stored?.phoneNumber ? `+91 ${stored.phoneNumber}` : '+91 98765 43210',
      provider: 'phone',
    };
  });
  // A saved JWT means the player already signed in — go straight to the app.
  const [step0] = useState<AuthStep>(() => (getStoredUser() && localStorage.getItem('thunder.auth.token') ? 'APP' : 'LOGIN'));
  useEffect(() => {
    if (step0 === 'APP') setStep('APP');
  }, [step0]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [identifier, setIdentifier] = useState('+91 98765 43210');
  const [provider, setProvider] = useState<AuthProvider>('phone');

  // Navigation & Screens state
  const [activeTab, setActiveTab] = useState<NavTab>('tournaments');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All Matches');
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [heroJoined, setHeroJoined] = useState(false);
  const [rawMatches, setRawMatches] = useState<Record<string, import('./lib/api').ApiTournament>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | undefined>(undefined);
  const [profileIgn, setProfileIgn] = useState('');
  const [profileUid, setProfileUid] = useState('');

  // Wallet state
  const [depositCash, setDepositCash] = useState(120);
  const [winningsCash, setWinningsCash] = useState(300);
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);

  // Ensure titles are strictly "Match Winnings | <Map>" and "Entry Fee | <Map>"
  useEffect(() => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        title:
          t.category === 'Winnings' && t.map
            ? `Match Winnings | ${t.map}`
            : t.category === 'Entries' && t.map
            ? `Entry Fee | ${t.map}`
            : t.title.replace(/[—–-]/g, '|').replace(/\s+Cup(\s*#\d+)?/gi, ''),
      }))
    );
  }, []);
  const [walletMode, setWalletMode] = useState<WalletMode>('add');
  const [addAmount, setAddAmount] = useState('100');
  const [upiId, setUpiId] = useState('9876543210@paytm');
  const [withdrawAmount, setWithdrawAmount] = useState('150');
  const [txFilter, setTxFilter] = useState<TxFilter>('All');
  const [copiedReference, setCopiedReference] = useState<string | null>(null);

  // Modals & BottomSheets state
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const balance = depositCash + winningsCash;

  /** Pull the player feed + wallet from the API (called on sign-in and refresh). */
  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const [list, wallet, me] = await Promise.all([
        api.tournaments.list(),
        api.wallet.summary(),
        api.auth.me().catch(() => null),
      ]);

      const feed = list.items.filter(isFeedMatch);
      setRawMatches(Object.fromEntries(feed.map((t) => [t.id, t])));
      setMatches(feed.map(toMatch));
      setJoinedIds(feed.filter((t) => t.mySlot).map((t) => t.id));
      setDepositCash(Number(wallet.depositBalance));
      setWinningsCash(Number(wallet.winningBalance));
      if (me) {
        setProfileIgn(me.inGameName ?? '');
        setProfileUid(me.inGameUid ?? '');
      }
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not load the lobby', 'error');
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'APP') void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 2800);
  };

  const handleLogin = (nextProvider?: AuthProvider) => {
    if (nextProvider === 'google') {
      setProvider('google');
      setIdentifier('demo.player@gmail.com');
      setStep('OTP');
      return;
    }

    setProvider('phone');
    const digitsOnly = identifier.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    setStep('OTP');
  };

  const joinMatch = async (
    match: TournamentMatch,
    identity: { inGameName: string; inGameUid: string }
  ) => {
    if (joinedIds.includes(match.id)) {
      showToast(`Already registered in ${match.title}`);
      return;
    }
    if (balance < match.entryFee) {
      showToast('Insufficient balance. Top up your wallet to join.', 'error');
      return;
    }

    setJoining(true);
    setJoinError(undefined);
    try {
      // The API owns the money move: it debits the fee and books the seat.
      await api.tournaments.join(match.id, {
        slotNumber: rawMatches[match.id]?.mySlot?.slotNumber,
        inGameName: identity.inGameName,
        inGameUid: identity.inGameUid,
        saveAsDefault: true,
      });

      setProfileIgn(identity.inGameName);
      setProfileUid(identity.inGameUid);
      setSelectedMatch(null);
      showToast(`Slot confirmed for ${match.title}!`);
      await loadFeed();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error as Error).message;
      setJoinError(message);
      showToast(message, 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleDeposit = () => {
    const amount = Number(addAmount);
    if (!amount || amount < 10) {
      showToast('Minimum deposit is ₹10.', 'error');
      return;
    }
    setDepositCash((value) => value + amount);
    setTransactions((prev) => [
      {
        id: `tx-${Date.now()}`,
        title: 'Added Cash via UPI',
        amount,
        isCredit: true,
        category: 'Deposits',
        channel: 'phonepe',
        badgeText: 'Deposit',
        badgeTone: 'emerald',
        time: 'Just now',
        dateGroup: 'TODAY',
        closingBalance: (depositCash + winningsCash) + amount,
        reference: generateUTR(),
        payoutMethod: 'Instant UPI',
        status: 'Success',
      },
      ...prev,
    ]);
    showToast(`Successfully added ₹${amount} via UPI!`);
  };

  const handleWithdrawal = () => {
    const amount = Number(withdrawAmount);
    if (!upiId.includes('@')) {
      showToast('Please enter a valid UPI VPA (e.g. name@oksbi).', 'error');
      return;
    }
    if (!amount || amount < 50) {
      showToast('Minimum withdrawal is ₹50.', 'error');
      return;
    }
    if (amount > winningsCash) {
      showToast('Withdrawal exceeds your available Winnings cash balance.', 'error');
      return;
    }

    setWinningsCash((value) => value - amount);
    setTransactions((prev) => [
      {
        id: `tx-${Date.now()}`,
        title: `Withdrawal to ${upiId}`,
        amount,
        isCredit: false,
        category: 'Withdrawals',
        channel: 'paytm',
        badgeText: 'Transferred',
        badgeTone: 'emerald',
        time: 'Just now',
        dateGroup: 'TODAY',
        closingBalance: (depositCash + winningsCash) - amount,
        reference: generateUTR(),
        payoutMethod: `${upiId} (IMPS)`,
        status: 'Success',
      },
      ...prev,
    ]);
    showToast(`₹${amount} transferred to ${upiId} instantly!`);
  };

  const handleCopy = (reference: string) => {
    setCopiedReference(reference);
    navigator.clipboard?.writeText?.(reference);
    showToast(`Copied ${reference} to clipboard`);
    window.setTimeout(() => setCopiedReference(null), 2000);
  };

  const handleSignOut = () => {
    setSignOutOpen(false);
    api.auth.logout();
    setStep('LOGIN');
    setAuthError(undefined);
    showToast('Signed out of Spartan Arena.');
  };

  /** OTP verified → exchange it for a real session. */
  const verifyOtp = async (code: string) => {
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      const phone = toPhone(identifier);
      if (!/^\d{10}$/.test(phone)) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }

      const session = DEV_AUTH
        ? await api.auth.loginDev(phone)
        : await api.auth.loginWithToken(phone, code);

      setUser({
        name: session.user.name ?? session.user.inGameName ?? 'Spartan Player',
        identifier: `+91 ${session.user.phoneNumber ?? phone}`,
        provider,
      });
      setStep('APP');
      showToast(`Welcome ${session.user.name ?? 'to Spartan Esports Arena'}!`);
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : (error as Error).message);
    } finally {
      setAuthBusy(false);
    }
  };

  // Step 1: Login
  if (step === 'LOGIN') {
    return (
      <LoginScreen
        theme={theme}
        onThemeToggle={() => setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'))}
        identifier={identifier}
        setIdentifier={setIdentifier}
        onContinue={handleLogin}
      />
    );
  }

  // Step 2: 2FA OTP
  if (step === 'OTP') {
    return (
      <OtpScreen
        theme={theme}
        onThemeToggle={() => setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'))}
        identifier={identifier}
        setIdentifier={setIdentifier}
        onBack={() => {
          setAuthError(undefined);
          setStep('LOGIN');
        }}
        onVerified={verifyOtp}
        busy={authBusy}
        errorText={authError}
      />
    );
  }

  // Step 3: Main App Dashboard (Tournaments, Wallet, Profile)
  return (
    <div
      className={
        theme === 'dark'
          ? 'relative min-h-screen w-full bg-[#050B14] text-slate-100 selection:bg-amber-400 selection:text-black font-sans'
          : 'relative min-h-screen w-full bg-[#F8FAFC] text-slate-900 selection:bg-amber-400 selection:text-black font-sans'
      }
    >
      <Ambient theme={theme} />

      {/* Sticky App Header */}
      <AppHeader
        theme={theme}
        title={
          activeTab === 'tournaments'
            ? 'Esports Lobby'
            : activeTab === 'wallet'
            ? 'Arena Wallet'
            : 'Arena Settings'
        }
        subtitle={
          activeTab === 'tournaments'
            ? 'Free Fire Max • Custom Scrims'
            : activeTab === 'wallet'
            ? 'Dual Ledger • Instant UPI'
            : 'Profile • Preferences • Rules'
        }
        balance={balance}
        onAddFunds={() => {
          setActiveTab('wallet');
          setWalletMode('add');
        }}
        onNotify={() => showToast('Next tournament starts in 1h 24m!')}
        hideBalance={activeTab === 'wallet'}
      />

      {/* Main Content Area - True Full-Screen Edge-to-Edge */}
      <main className="relative z-10 mx-auto w-full max-w-lg px-4 pt-4 pb-28 sm:px-6">
        {activeTab === 'tournaments' && (
          <TournamentsScreen
            theme={theme}
            matches={matches}
            joinedIds={joinedIds}
            onOpenMatch={(match) => setSelectedMatch(match)}
            selectedFilter={selectedFilter}
            onFilter={(filter) => setSelectedFilter(filter)}
            onLockedGame={(name) =>
              showToast(`${name} scrims unlocking next season!`, 'error')
            }
            loading={feedLoading}
            onRefresh={() => void loadFeed()}
            heroJoined={heroJoined}
            onHeroJoin={() => {
              const hero = matches[0];
              if (hero) setSelectedMatch(hero);
            }}
          />
        )}

        {activeTab === 'wallet' && (
          <WalletScreen
            theme={theme}
            depositCash={depositCash}
            winningsCash={winningsCash}
            walletMode={walletMode}
            setWalletMode={setWalletMode}
            addAmount={addAmount}
            setAddAmount={setAddAmount}
            upiId={upiId}
            setUpiId={setUpiId}
            withdrawAmount={withdrawAmount}
            setWithdrawAmount={setWithdrawAmount}
            transactions={transactions}
            txFilter={txFilter}
            setTxFilter={setTxFilter}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdrawal}
            copiedReference={copiedReference}
            onCopy={handleCopy}
          />
        )}

        {(activeTab === 'settings' || activeTab === 'profile') && (
          <SettingsScreen
            theme={theme}
            onThemeToggle={(nextTheme) => setTheme(nextTheme)}
            user={user}
            provider={provider}
            setProvider={setProvider}
            joinedCount={joinedIds.length}
            onSignOut={() => setSignOutOpen(true)}
            onWhatsApp={() => {
              window.open('https://wa.me/919999900001?text=Help%20with%20Tournament', '_blank');
              showToast('Opening WhatsApp support channel...');
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* 3-Tab Bottom Navigation Dock */}
      <BottomNav theme={theme} activeTab={activeTab} onChange={(tab) => setActiveTab(tab)} />

      {/* Cupertino Match Quick-Join Sheet */}
      {selectedMatch && (
        <MatchSheet
          theme={theme}
          match={selectedMatch}
          balance={balance}
          joined={joinedIds.includes(selectedMatch.id)}
          defaultIgn={profileIgn}
          defaultUid={profileUid}
          joinError={joinError}
          joining={joining}
          joinClosed={rawMatches[selectedMatch.id] ? isJoinClosed(rawMatches[selectedMatch.id]) : false}
          onClose={() => {
            setSelectedMatch(null);
            setJoinError(undefined);
          }}
          onJoin={(identity) => void joinMatch(selectedMatch, identity)}
          onTopUp={() => {
            setSelectedMatch(null);
            setActiveTab('wallet');
            setWalletMode('add');
          }}
        />
      )}

      {/* Arena Settings & Fair Play Drawer */}
      {settingsOpen && (
        <SettingsSheet
          theme={theme}
          onTheme={(nextTheme) => setTheme(nextTheme)}
          onClose={() => setSettingsOpen(false)}
          onWhatsApp={() => {
            window.open('https://wa.me/919999900001?text=Help%20with%20Tournament', '_blank');
            showToast('Opening WhatsApp support channel...');
          }}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      {signOutOpen && (
        <SignOutModal
          theme={theme}
          onClose={() => setSignOutOpen(false)}
          onConfirm={handleSignOut}
        />
      )}

      {/* Toast Notification Pill */}
      {toast && <Toast toast={toast} />}
    </div>
  );
}
export default App;
