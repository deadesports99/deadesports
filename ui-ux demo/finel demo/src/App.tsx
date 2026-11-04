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
  HERO_MATCH,
  INITIAL_MATCHES,
  INITIAL_TRANSACTIONS,
} from './data/mockData';
import { generateUTR } from './utils/formatters';

// Common Components
import { Ambient } from './components/common/Ambient';
import { Toast } from './components/common/Toast';

// Navigation
import { AppHeader } from './components/navigation/AppHeader';
import { BottomNav } from './components/navigation/BottomNav';

// Modals & Sheets
import { MatchSheet } from './components/tournaments/MatchSheet';
import { SettingsSheet } from './components/modals/SettingsSheet';
import { SecurityModal } from './components/modals/SecurityModal';
import { SignOutModal } from './components/modals/SignOutModal';

// Screens
import { LoginScreen } from './screens/auth/LoginScreen';
import { OtpScreen } from './screens/auth/OtpScreen';
import { TournamentsScreen } from './screens/TournamentsScreen';
import { WalletScreen } from './screens/WalletScreen';
import { ProfileScreen } from './screens/ProfileScreen';

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
  const [user, setUser] = useState<UserProfile>({
    name: 'Spartan Player',
    identifier: '+91 98765 43210',
    provider: 'phone',
  });
  const [identifier, setIdentifier] = useState('+91 98765 43210');
  const [provider, setProvider] = useState<AuthProvider>('phone');

  // Navigation & Screens state
  const [activeTab, setActiveTab] = useState<NavTab>('tournaments');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All Matches');
  const [matches, setMatches] = useState<TournamentMatch[]>(INITIAL_MATCHES);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [heroJoined, setHeroJoined] = useState(false);

  // Wallet state
  const [depositCash, setDepositCash] = useState(120);
  const [winningsCash, setWinningsCash] = useState(300);
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [walletMode, setWalletMode] = useState<WalletMode>('add');
  const [addAmount, setAddAmount] = useState('100');
  const [upiId, setUpiId] = useState('9876543210@paytm');
  const [withdrawAmount, setWithdrawAmount] = useState('150');
  const [txFilter, setTxFilter] = useState<TxFilter>('All');
  const [copiedReference, setCopiedReference] = useState<string | null>(null);

  // Modals & BottomSheets state
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const balance = depositCash + winningsCash;

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

  const joinMatch = (match: TournamentMatch) => {
    if (joinedIds.includes(match.id)) {
      showToast(`Already registered in ${match.title}`);
      return;
    }
    if (balance < match.entryFee) {
      showToast('Insufficient balance. Top up your wallet to join.', 'error');
      return;
    }

    const fromDeposit = Math.min(depositCash, match.entryFee);
    setDepositCash((value) => value - fromDeposit);
    setWinningsCash((value) => value - (match.entryFee - fromDeposit));
    setJoinedIds((ids) => [...ids, match.id]);

    if (match.id === HERO_MATCH.id) setHeroJoined(true);

    setMatches((items) =>
      items.map((item) =>
        item.id === match.id
          ? { ...item, filledSlots: Math.min(item.totalSlots, item.filledSlots + 1) }
          : item
      )
    );

    setTransactions((prev) => [
      {
        id: `tx-${Date.now()}`,
        title: `Entry Fee: ${match.title}`,
        amount: match.entryFee,
        isCredit: false,
        category: 'Entries',
        badgeText: 'Slot Secured',
        badgeTone: 'cyan',
        time: 'Just now',
        reference: `REG-${Math.floor(1000000 + Math.random() * 9000000)}`,
      },
      ...prev,
    ]);

    setSelectedMatch(null);
    showToast(`Slot Confirmed for ${match.title}! Room details arrive 15m prior.`);
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
        title: 'UPI Fast Deposit Successful',
        amount,
        isCredit: true,
        category: 'Deposits',
        badgeText: 'Instant Add',
        badgeTone: 'cyan',
        time: 'Just now',
        reference: generateUTR(),
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
        title: `UPI Payout to ${upiId}`,
        amount,
        isCredit: false,
        category: 'Withdrawals',
        badgeText: 'Transfer Success',
        badgeTone: 'emerald',
        time: 'Just now',
        reference: generateUTR(),
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
    setStep('LOGIN');
    showToast('Signed out of Spartan Arena.');
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
        onBack={() => setStep('LOGIN')}
        onVerified={() => {
          setUser({
            name: provider === 'google' ? 'Google Player' : 'Spartan Player',
            identifier,
            provider,
          });
          setStep('DASHBOARD');
          showToast('Welcome to Spartan Esports Arena!');
        }}
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
            : 'Player Profile'
        }
        subtitle={
          activeTab === 'tournaments'
            ? 'Free Fire Max • Custom Scrims'
            : activeTab === 'wallet'
            ? 'Dual Ledger • Instant UPI'
            : 'Grandmaster Verified'
        }
        balance={balance}
        onAddFunds={() => {
          setActiveTab('wallet');
          setWalletMode('add');
        }}
        onNotify={() => showToast('Next tournament starts in 1h 24m!')}
        onSettings={activeTab === 'profile' ? () => setSettingsOpen(true) : undefined}
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
            heroJoined={heroJoined}
            onHeroJoin={() => joinMatch(HERO_MATCH)}
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

        {activeTab === 'profile' && (
          <ProfileScreen
            theme={theme}
            user={user}
            provider={provider}
            setProvider={setProvider}
            joinedCount={joinedIds.length}
            onOpenSettings={() => setSettingsOpen(true)}
            onSecurity={() => setSecurityOpen(true)}
            onSignOut={() => setSignOutOpen(true)}
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
          onClose={() => setSelectedMatch(null)}
          onJoin={() => joinMatch(selectedMatch)}
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

      {/* 4-Digit Security PIN Modal */}
      {securityOpen && (
        <SecurityModal
          theme={theme}
          onClose={() => setSecurityOpen(false)}
          onSave={() => {
            setSecurityOpen(false);
            showToast('Security PIN updated successfully!');
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
