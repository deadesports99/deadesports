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
import type { ApiWallet } from './lib/api';

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
import { ProfileScreen, type PlayerCareerStats } from './screens/ProfileScreen';

const LEDGER_LOOK: Record<string, { category: TransactionItem['category']; title: string; badge: string; tone: TransactionItem['badgeTone'] }> = {
  ADD_MONEY: { category: 'Deposits', title: 'Added Cash', badge: 'Deposit', tone: 'emerald' },
  JOIN_FEE: { category: 'Entries', title: 'Entry Fee', badge: 'Confirmed', tone: 'cyan' },
  WINNING_PRIZE: { category: 'Winnings', title: 'Prize Payout', badge: 'Winnings', tone: 'amber' },
  WITHDRAWAL: { category: 'Withdrawals', title: 'Withdrawal', badge: 'Processing', tone: 'slate' },
  REFUND: { category: 'Deposits', title: 'Refund', badge: 'Refunded', tone: 'emerald' },
};

/** Backend ledger row → the row shape the demo wallet list already renders. */
function toTransaction(entry: ApiWallet['ledger'][number]): TransactionItem {
  const look = LEDGER_LOOK[entry.category] ?? {
    category: 'Deposits' as const,
    title: entry.category,
    badge: entry.type === 'CREDIT' ? 'Credit' : 'Debit',
    tone: 'slate' as const,
  };
  const when = new Date(entry.createdAt);
  const isToday = when.toDateString() === new Date().toDateString();
  return {
    id: entry.id,
    title: entry.notes?.trim() || look.title,
    amount: Number(entry.amount),
    isCredit: entry.type === 'CREDIT',
    category: look.category,
    badgeText: look.badge,
    badgeTone: look.tone,
    time: when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
    dateGroup: isToday ? 'TODAY' : when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase(),
    closingBalance: Number(entry.balanceAfter),
    reference: entry.referenceId ?? entry.id.slice(0, 12).toUpperCase(),
    status: 'Success',
    channel: entry.category === 'WINNING_PRIZE' ? 'freefire_win' : entry.category === 'JOIN_FEE' ? 'freefire_entry' : 'gpay',
  };
}

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
  const [paying, setPaying] = useState(false);
  /** Bumped after a successful deposit/withdraw so the wallet sheet closes. */
  const [paymentDone, setPaymentDone] = useState(0);
  const [joinError, setJoinError] = useState<string | undefined>(undefined);
  const [profileIgn, setProfileIgn] = useState('');
  const [profileUid, setProfileUid] = useState('');
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const [career, setCareer] = useState<PlayerCareerStats | null>(null);

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

  /** Wallet balances + the real ledger, used by the Wallet screen. */
  const loadWallet = async () => {
    const summary = await api.wallet.summary(1, 25);
    setDepositCash(Number(summary.depositBalance));
    setWinningsCash(Number(summary.winningBalance));
    setTransactions(summary.ledger.map(toTransaction));
    return summary;
  };

  /** Pull the player feed + wallet from the API (called on sign-in and refresh). */
  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const [list, wallet, me, stats] = await Promise.all([
        api.tournaments.list(),
        api.wallet.summary(1, 25),
        api.auth.me().catch(() => null),
        api.player.stats().catch(() => null),
      ]);

      const feed = list.items.filter(isFeedMatch);
      setRawMatches(Object.fromEntries(feed.map((t) => [t.id, t])));
      setMatches(feed.map(toMatch));
      setJoinedIds(feed.filter((t) => t.mySlot).map((t) => t.id));
      setDepositCash(Number(wallet.depositBalance));
      setWinningsCash(Number(wallet.winningBalance));
      setTransactions(wallet.ledger.map(toTransaction));
      if (me) {
        setProfileIgn(me.inGameName ?? '');
        setProfileUid(me.inGameUid ?? '');
        setPlayerCode(me.playerCode ?? null);
      }
      if (stats) setCareer(stats);
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

  const handleDeposit = async () => {
    const amount = Number(addAmount);
    if (!amount || amount < 10) {
      showToast('Minimum deposit is ₹10.', 'error');
      return;
    }
    if (paying) return;

    setPaying(true);
    try {
      // The API owns the money move: create the gateway order, then settle it.
      const order = await api.payments.createOrder(amount);

      if (order.provider === 'mock') {
        // Local demo: the mock checkout is simulated instantly (no real money).
        await api.payments.demoPay(order.providerOrderId, 'success');
      } else if (order.checkoutUrl) {
        window.open(order.checkoutUrl, '_blank', 'noopener');
      }

      // Poll until the webhook/settlement flips the order to CAPTURED.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const status = await api.payments.status(order.orderId);
        if (status.status === 'CAPTURED') break;
        if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          throw new Error(`Payment ${status.status.toLowerCase()}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      await loadWallet();
      setPaymentDone((n) => n + 1);
      setAddAmount('');
      showToast(`₹${amount} added to your wallet.`);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : (error as Error).message, 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleWithdrawal = async () => {
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
      showToast('Withdrawal exceeds your Winnings cash balance.', 'error');
      return;
    }
    if (paying) return;

    setPaying(true);
    try {
      await api.wallet.withdraw(amount, upiId);
      await loadWallet();
      setPaymentDone((n) => n + 1);
      setWithdrawAmount('');
      showToast(`₹${amount} withdrawal requested — admin will approve it.`);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : (error as Error).message, 'error');
    } finally {
      setPaying(false);
    }
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
            : activeTab === 'profile'
            ? 'Player Profile'
            : 'Arena Settings'
        }
        subtitle={
          activeTab === 'tournaments'
            ? 'Free Fire Max • Custom Scrims'
            : activeTab === 'wallet'
            ? 'Dual Ledger • Instant UPI'
            : activeTab === 'profile'
            ? 'Identity • Career • Support'
            : 'Preferences • Notifications • Rules'
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
            paying={paying}
            paymentDone={paymentDone}
            copiedReference={copiedReference}
            onCopy={handleCopy}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            theme={theme}
            user={user}
            provider={provider}
            joinedCount={joinedIds.length}
            playerCode={playerCode}
            stats={career}
            inGameName={profileIgn}
            inGameUid={profileUid}
            onSaveGameProfile={async (ign, uid) => {
              const updated = await api.player.updateGameProfile(ign, uid);
              setProfileIgn(updated.inGameName);
              setProfileUid(updated.inGameUid);
              showToast('Free Fire details saved.');
            }}
            onOpenSettings={() => setActiveTab('settings')}
            onSecurity={() => showToast('Your account is protected by OTP login on this number.')}
            onSignOut={() => setSignOutOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={
                theme === 'dark'
                  ? 'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-300'
                  : 'rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700'
              }
            >
              ← Back to profile
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
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
