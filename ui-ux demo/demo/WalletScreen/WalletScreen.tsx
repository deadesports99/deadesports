import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Wallet,
  Gamepad2,
  User,
  Sun,
  Moon,
  Trophy,
  Sparkles,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Zap,
  RefreshCw,
} from '../icons/tg-icons';

type NavTab = 'tournaments' | 'wallet' | 'profile';
type WalletMode = 'add' | 'withdraw';
type TxFilter = 'All' | 'Deposits' | 'Winnings' | 'Withdrawals';

interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  isCredit: boolean;
  category: Exclude<TxFilter, 'All'> | 'Entry';
  badgeText: string;
  badgeTone: 'slate' | 'emerald' | 'cyan';
  time: string;
  utr: string;
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-101',
    title: 'Tournament Entry: Bermuda Pro Scrims #42',
    amount: 30,
    isCredit: false,
    category: 'Entry',
    badgeText: 'Entry Fee',
    badgeTone: 'slate',
    time: 'Today, 08:45 PM',
    utr: 'EGA-8841209',
  },
  {
    id: 'tx-102',
    title: 'Booyah 1st Place: Purgatory Cup #38',
    amount: 350,
    isCredit: true,
    category: 'Winnings',
    badgeText: 'Winnings Won',
    badgeTone: 'emerald',
    time: 'Yesterday, 10:20 PM',
    utr: 'WIN-9920418',
  },
  {
    id: 'tx-103',
    title: 'UPI Deposit via PhonePe',
    amount: 200,
    isCredit: true,
    category: 'Deposits',
    badgeText: 'Deposit',
    badgeTone: 'cyan',
    time: 'Yesterday, 06:12 PM',
    utr: 'UTR-431900821412',
  },
  {
    id: 'tx-104',
    title: 'UPI Withdrawal to 9876543210@paytm',
    amount: 250,
    isCredit: false,
    category: 'Withdrawals',
    badgeText: 'Transfer Success',
    badgeTone: 'emerald',
    time: '01 Nov, 04:05 PM',
    utr: 'UTR-431788510924',
  },
];

const QUICK_ADD_AMOUNTS = [50, 100, 200, 500];
const TX_FILTERS: TxFilter[] = ['All', 'Deposits', 'Winnings', 'Withdrawals'];

export default function FreeFireWalletScreen() {
  // Theme & Bottom Dock State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('wallet');
  const isDark = theme === 'dark';

  // Core Dual-Entry Wallet Balances
  const [depositCash, setDepositCash] = useState<number>(120);
  const [winningsCash, setWinningsCash] = useState<number>(300);
  const totalBalance = depositCash + winningsCash;

  // Interactive Action Mode ('add' | 'withdraw')
  const [walletMode, setWalletMode] = useState<WalletMode>('add');

  // Add Money Form State
  const [addAmount, setAddAmount] = useState<string>('100');
  const [addFocused, setAddFocused] = useState<boolean>(false);

  // Withdraw Money Form State
  const [upiId, setUpiId] = useState<string>('9876543210@paytm');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('150');
  const [upiFocused, setUpiFocused] = useState<boolean>(true);
  const [withdrawAmtFocused, setWithdrawAmtFocused] = useState<boolean>(false);

  // Transaction Ledger & UI Feedback State
  const [txFilter, setTxFilter] = useState<TxFilter>('All');
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 2800);
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    if (txFilter === 'All') return transactions;
    return transactions.filter((tx) => tx.category === txFilter);
  }, [transactions, txFilter]);

  // Handle Quick Chip Selection (+₹50, +₹100, +₹200, +₹500)
  const handleSelectQuickChip = (value: number) => {
    setAddAmount(String(value));
  };

  // Handle UPI Deposit Submission
  const handleAddCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(addAmount);
    if (!numericAmount || numericAmount < 10) {
      showToast('Minimum UPI deposit amount is ₹10', 'error');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setDepositCash((prev) => prev + numericAmount);

      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        title: 'UPI Deposit via GPay / PhonePe',
        amount: numericAmount,
        isCredit: true,
        category: 'Deposits',
        badgeText: 'Deposit',
        badgeTone: 'cyan',
        time: 'Just now',
        utr: `UTR-4320${Math.floor(10000000 + Math.random() * 90000000)}`,
      };

      setTransactions((prev) => [newTx, ...prev]);
      showToast(`₹${numericAmount} added to Deposit Cash via UPI!`);
    }, 650);
  };

  // Handle Instant UPI Withdrawal Submission
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericWithdraw = Number(withdrawAmount);
    const trimmedUpi = upiId.trim();

    if (!trimmedUpi.includes('@') || trimmedUpi.length < 5) {
      showToast('Please enter a valid UPI ID (e.g. player@oksbi)', 'error');
      return;
    }
    if (!numericWithdraw || numericWithdraw < 50) {
      showToast('Minimum UPI withdrawal amount is ₹50', 'error');
      return;
    }
    if (numericWithdraw > winningsCash) {
      showToast(`Amount exceeds withdrawable Winnings Cash (₹${winningsCash})`, 'error');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setWinningsCash((prev) => prev - numericWithdraw);

      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        title: `UPI Withdrawal to ${trimmedUpi}`,
        amount: numericWithdraw,
        isCredit: false,
        category: 'Withdrawals',
        badgeText: 'Transfer Success',
        badgeTone: 'emerald',
        time: 'Just now',
        utr: `UTR-4320${Math.floor(10000000 + Math.random() * 90000000)}`,
      };

      setTransactions((prev) => [newTx, ...prev]);
      setWithdrawAmount(String(Math.max(0, winningsCash - numericWithdraw)));
      showToast(`₹${numericWithdraw} transferred to ${trimmedUpi}!`);
    }, 750);
  };

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard?.writeText(utr);
    setCopiedId(utr);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div
      className={`relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 transition-colors duration-500 overflow-hidden select-none ${
        isDark ? 'bg-[#081326] text-white' : 'bg-[#DCE4EE] text-slate-900'
      }`}
    >
      {/* 1. Ambient Outer Background Mesh & Perspective Esports Grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[130px] transition-opacity duration-700 ${
            isDark ? 'bg-sky-500/20 opacity-100' : 'bg-sky-400/30 opacity-80'
          }`}
        />
        <div
          className={`absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? 'bg-amber-500/15 opacity-100' : 'bg-amber-400/25 opacity-70'
          }`}
        />
        <div
          className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:36px_36px] ${
            isDark ? 'opacity-60' : 'opacity-30'
          }`}
        />
      </div>

      {/* Floating Sun/Moon Live Theme Switcher (Top-Right) */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle color theme"
          className={`group flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-semibold tracking-wide transition-all duration-300 active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-slate-900/75 text-slate-100 border border-white/15 shadow-lg shadow-black/40 hover:border-amber-400/50'
              : 'bg-white/85 text-slate-800 border border-slate-900/10 shadow-lg shadow-slate-900/10 hover:border-sky-500/40'
          } backdrop-blur-xl`}
        >
          {isDark ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-sky-600 transition-transform duration-300 group-hover:-rotate-12" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Main Wallet Container with Strict Dual-Theme Glassmorphism */}
      <main
        className={`relative w-full max-w-[430px] rounded-[26px] overflow-hidden transition-all duration-500 ${
          isDark
            ? 'bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/75'
            : 'bg-white/75 backdrop-blur-md border border-slate-900/10 shadow-xl shadow-slate-900/15'
        }`}
      >
        {/* Subtle Atmospheric Header Mesh & Starfield Particles */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
          <div
            className={`absolute inset-0 ${
              isDark
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(255,208,0,0.16),_rgba(0,194,255,0.16)_45%,_transparent_100%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(251,191,36,0.2),_rgba(56,189,248,0.18)_45%,_transparent_100%)]'
            }`}
          />
          <svg
            viewBox="0 0 430 220"
            fill="none"
            className="absolute inset-0 h-full w-full opacity-60"
          >
            <circle cx="355" cy="26" r="1.4" fill="#FACC15" />
            <circle cx="290" cy="44" r="1.2" fill="#38BDF8" />
            <circle cx="395" cy="68" r="1.5" fill="#7DD3FC" />
            <circle cx="220" cy="20" r="1.1" fill="#E0F2FE" />
            <path
              d="M275 12L400 88"
              stroke="#FACC15"
              strokeOpacity="0.25"
              strokeWidth="0.75"
              strokeDasharray="3 5"
            />
          </svg>
        </div>

        {/* Floating Status Toast */}
        {feedbackToast && (
          <div className="absolute top-16 inset-x-5 z-40 flex items-center justify-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md border transition-all ${
                feedbackToast.type === 'error'
                  ? 'bg-rose-950/95 text-rose-200 border-rose-400/40'
                  : isDark
                  ? 'bg-slate-950/95 text-emerald-300 border-emerald-400/35 shadow-black/60'
                  : 'bg-slate-900 text-emerald-300 border-emerald-400/40 shadow-slate-900/20'
              }`}
            >
              {feedbackToast.type === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <span>{feedbackToast.text}</span>
            </div>
          </div>
        )}

        {/* 3. TOP APP HEADER */}
        <header
          className={`relative z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b ${
            isDark ? 'border-white/10' : 'border-slate-900/10'
          }`}
        >
          {/* Left: Spartan Hexagonal Crest Badge + Title "ARENA WALLET" */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1 rounded-full bg-amber-400/20 blur-xs" />
              <svg
                width="34"
                height="36"
                viewBox="0 0 64 68"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative drop-shadow-[0_2px_8px_rgba(255,208,0,0.3)]"
              >
                <path
                  d="M32 3L57 13.5V33.5C57 49.5 46.2 60.8 32 65C17.8 60.8 7 49.5 7 33.5V13.5L32 3Z"
                  fill="#0B192E"
                  stroke="#38BDF8"
                  strokeWidth="3"
                />
                <path
                  d="M32 14C25.5 14 21 18.8 21 25.5V33L26.5 36.5L28.5 30.5H35.5L37.5 36.5L43 33V25.5C43 18.8 38.5 14 32 14Z"
                  fill="#E2E8F0"
                />
                <path d="M24.5 25.5L30 27.5L29 29.5L24 27.5Z" fill="#00D2FF" />
                <path d="M39.5 25.5L34 27.5L35 29.5L40 27.5Z" fill="#00D2FF" />
                <rect
                  x="10"
                  y="39"
                  width="44"
                  height="12"
                  rx="2.5"
                  fill="#091326"
                  stroke="#FACC15"
                  strokeWidth="1.5"
                />
                <text
                  x="32"
                  y="47.5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="6.5"
                  fontWeight="900"
                  letterSpacing="0.06em"
                >
                  EGA
                </text>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1
                  className={`text-[13px] font-extrabold tracking-wider uppercase ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  ARENA WALLET
                </h1>
              </div>
              <p
                className={`text-[10px] font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Instant Prize &amp; Entry Ledger
              </p>
            </div>
          </div>

          {/* Right: Security / Verified Shield Badge ("100% Safe UPI Payouts") */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-tight border ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>100% Safe UPI Payouts</span>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <div className="relative z-10 px-4 pt-3.5 pb-24 space-y-4">
          {activeTab === 'wallet' && (
            <>
              {/* 4. DUAL-ENTRY BALANCE SHOWCASE (THE CORE CARD) */}
              <section
                className={`relative overflow-hidden rounded-2xl p-4 border transition-all ${
                  isDark
                    ? 'bg-gradient-to-br from-[#0D1B32]/95 via-[#0B1526]/95 to-[#091220]/95 border-white/10 shadow-xl shadow-black/50'
                    : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white shadow-lg'
                }`}
              >
                {/* Ambient Cyber Gold & Cyan Glow */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#FFD000]/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#00C2FF]/15 blur-2xl" />

                {/* Total Balance Header Row */}
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Total Arena Balance
                    </span>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-[28px] font-black tracking-tight text-[#FFD000] drop-shadow-[0_0_10px_rgba(255,208,0,0.45)]">
                        ₹
                      </span>
                      <span className="text-2xl sm:text-[28px] font-black tracking-tight text-white">
                        {totalBalance.toLocaleString('en-IN')}
                      </span>
                      <span className="ml-1.5 rounded bg-emerald-400/15 border border-emerald-400/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                        LIVE SYNC
                      </span>
                    </div>
                  </div>

                  {/* Dual Compact Action Buttons (Top-Right or Inline Pair) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWalletMode('add')}
                      className={`inline-flex items-center gap-1 rounded-lg py-1.5 px-3 text-xs font-extrabold transition-all active:scale-[0.96] cursor-pointer ${
                        walletMode === 'add'
                          ? 'bg-[#FFD000] text-slate-950 shadow-md shadow-amber-400/30 ring-2 ring-amber-300/50'
                          : 'bg-[#FFD000]/90 hover:bg-[#FFD000] text-slate-950'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[3]" />
                      <span>Add Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWalletMode('withdraw')}
                      className={`inline-flex items-center gap-1 rounded-lg py-1.5 px-3 text-xs font-bold transition-all active:scale-[0.96] cursor-pointer border ${
                        walletMode === 'withdraw'
                          ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF] shadow-[0_0_12px_rgba(0,194,255,0.25)]'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-white/15 backdrop-blur-md'
                      }`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Withdraw</span>
                    </button>
                  </div>
                </div>

                {/* 2-Column Split Matrix: Deposit Cash vs Winnings Cash */}
                <div className="relative z-10 mt-3.5 grid grid-cols-2 gap-2.5">
                  {/* Column A: Deposit Cash */}
                  <div className="rounded-xl bg-slate-950/60 border border-white/10 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                        Deposit Cash
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00C2FF]" />
                    </div>
                    <p className="mt-1 text-base font-black text-white">
                      ₹{depositCash.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">
                      For entering tournament lobbies
                    </p>
                  </div>

                  {/* Column B: Winnings Cash */}
                  <div className="rounded-xl bg-slate-950/60 border border-emerald-400/25 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Winnings Cash
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <p className="mt-1 text-base font-black text-emerald-300">
                      ₹{winningsCash.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-300 leading-tight flex items-center gap-1">
                      <span>100% withdrawable to UPI</span>
                    </p>
                  </div>
                </div>
              </section>

              {/* 5 & 6. INTERACTIVE ADD MONEY / WITHDRAW MONEY PANEL */}
              <section
                className={`rounded-2xl p-3.5 border transition-all ${
                  isDark
                    ? 'bg-[#0B1526]/90 border-white/10'
                    : 'bg-white/90 border-slate-300/85 shadow-xs'
                }`}
              >
                {/* Mode Switcher Tabs Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {walletMode === 'add' ? (
                      <>
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <h2
                          className={`text-xs font-extrabold uppercase tracking-wider ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          Instant Deposit (Zero Fee)
                        </h2>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#00C2FF]" />
                        <h2
                          className={`text-xs font-extrabold uppercase tracking-wider ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          Instant UPI Payout
                        </h2>
                      </>
                    )}
                  </div>

                  <div
                    className={`inline-flex rounded-lg p-0.5 text-[10px] font-bold border ${
                      isDark
                        ? 'bg-slate-950/70 border-white/10 text-slate-400'
                        : 'bg-slate-200/80 border-slate-300 text-slate-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setWalletMode('add')}
                      className={`rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                        walletMode === 'add'
                          ? 'bg-[#FFD000] text-slate-950 font-extrabold'
                          : 'hover:text-amber-400'
                      }`}
                    >
                      + Add Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletMode('withdraw')}
                      className={`rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                        walletMode === 'withdraw'
                          ? 'bg-[#00C2FF] text-slate-950 font-extrabold'
                          : 'hover:text-sky-400'
                      }`}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                {walletMode === 'add' ? (
                  /* 5. INTERACTIVE "ADD MONEY" QUICK CHIPS & UPI PAY */
                  <form onSubmit={handleAddCashSubmit} className="space-y-3" noValidate>
                    {/* Quick Amount Chips: +₹50, +₹100, +₹200, +₹500 */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUICK_ADD_AMOUNTS.map((amt) => {
                        const isSelected = Number(addAmount) === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleSelectQuickChip(amt)}
                            className={`rounded-lg py-1.5 px-2 text-xs font-extrabold transition-all active:scale-95 cursor-pointer border ${
                              isSelected
                                ? isDark
                                  ? 'bg-amber-400/15 border-[#FFD000] text-[#FFD000] shadow-[0_0_10px_rgba(255,208,0,0.2)]'
                                  : 'bg-slate-900 border-[#FFD000] text-[#FFD000]'
                                : isDark
                                ? 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-white/25'
                                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200/70'
                            }`}
                          >
                            +₹{amt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Amount Input with Cyber Gold Focus Border */}
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-amber-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={10}
                        max={50000}
                        value={addAmount}
                        onFocus={() => setAddFocused(true)}
                        onBlur={() => setAddFocused(false)}
                        onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="Enter deposit amount"
                        aria-label="Deposit Amount in Rupees"
                        className={`w-full rounded-lg pl-7 pr-24 py-2 text-xs font-extrabold outline-none transition-all border ${
                          isDark
                            ? 'bg-[#081120] text-white placeholder-slate-500'
                            : 'bg-slate-900 text-white placeholder-slate-400'
                        } ${
                          addFocused
                            ? 'border-amber-400 ring-2 ring-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                            : 'border-amber-400/70'
                        }`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-400">
                        No GST / 100% Value
                      </span>
                    </div>

                    {/* Compact "Pay via UPI (GPay / PhonePe / Paytm)" Button */}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-2 px-3 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-400/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Connecting UPI App...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5 fill-slate-950" />
                          <span>
                            Pay ₹{addAmount || 0} via UPI (GPay / PhonePe / Paytm)
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* 6. INTERACTIVE "WITHDRAW MONEY" FORM */
                  <form onSubmit={handleWithdrawSubmit} className="space-y-2.5" noValidate>
                    {/* Input 1: Enter UPI ID with Cyber Gold Active Border */}
                    <div>
                      <label
                        htmlFor="wallet-upi-id"
                        className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Verified UPI ID<span className="text-amber-400">*</span>
                      </label>
                      <input
                        id="wallet-upi-id"
                        type="text"
                        value={upiId}
                        onFocus={() => setUpiFocused(true)}
                        onBlur={() => setUpiFocused(false)}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. player@oksbi or 9876543210@paytm"
                        className={`w-full rounded-lg px-3 py-2 text-xs font-semibold outline-none transition-all border ${
                          isDark
                            ? 'bg-[#081120] text-white placeholder-slate-500'
                            : 'bg-slate-900 text-white placeholder-slate-400'
                        } ${
                          upiFocused
                            ? 'border-amber-400 ring-2 ring-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                            : 'border-amber-400/70'
                        }`}
                      />
                    </div>

                    {/* Input 2: Withdrawal Amount with "Max" Withdrawable Quick Button */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="wallet-withdraw-amt"
                          className={`block text-[10px] font-bold uppercase tracking-wider ${
                            isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          Withdrawal Amount<span className="text-amber-400">*</span>
                        </label>
                        <span
                          className={`text-[10px] font-semibold ${
                            isDark ? 'text-emerald-400' : 'text-emerald-700'
                          }`}
                        >
                          Available Winnings: ₹{winningsCash}
                        </span>
                      </div>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-amber-400">
                          ₹
                        </span>
                        <input
                          id="wallet-withdraw-amt"
                          type="number"
                          min={50}
                          max={winningsCash}
                          value={withdrawAmount}
                          onFocus={() => setWithdrawAmtFocused(true)}
                          onBlur={() => setWithdrawAmtFocused(false)}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="Min. ₹50"
                          className={`w-full rounded-lg pl-7 pr-16 py-2 text-xs font-extrabold outline-none transition-all border ${
                            isDark
                              ? 'bg-[#081120] text-white placeholder-slate-500'
                              : 'bg-slate-900 text-white placeholder-slate-400'
                          } ${
                            withdrawAmtFocused
                              ? 'border-amber-400 ring-2 ring-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                              : 'border-white/15'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setWithdrawAmount(String(winningsCash))}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 transition-colors cursor-pointer"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    {/* Helper Text */}
                    <p
                      className={`text-[10px] font-medium flex items-center gap-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      <Clock className="h-3 w-3 text-[#00C2FF] shrink-0" />
                      <span>
                        Min. withdrawal ₹50 • Zero TDS / Zero Fee • Instant 2-min transfer
                      </span>
                    </p>

                    {/* Compact CTA: "Transfer to UPI Now" */}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-2 px-3 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-400/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Processing IMPS / UPI Transfer...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Transfer to UPI Now</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </section>

              {/* 7. TRANSACTION HISTORY LEDGER */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    Recent Transactions
                  </h3>
                  <span
                    className={`text-[10px] font-semibold ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {filteredTransactions.length} Records
                  </span>
                </div>

                {/* Interactive Filter Chips ("All", "Deposits", "Winnings", "Withdrawals") */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {TX_FILTERS.map((filter) => {
                    const isActive = txFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setTxFilter(filter)}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer border ${
                          isActive
                            ? isDark
                              ? 'bg-amber-400/15 border-[#FFD000] text-[#FFD000] shadow-[0_0_10px_rgba(255,208,0,0.18)]'
                              : 'bg-slate-900 border-[#FFD000] text-[#FFD000]'
                            : isDark
                            ? 'bg-[#0B1526]/80 border-white/10 text-slate-400 hover:text-slate-200'
                            : 'bg-white/80 border-slate-300/80 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>

                {/* Transactions List */}
                <div className="space-y-2">
                  {filteredTransactions.map((tx) => {
                    const pillStyles =
                      tx.badgeTone === 'emerald'
                        ? isDark
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : tx.badgeTone === 'cyan'
                        ? isDark
                          ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                          : 'bg-sky-50 text-sky-700 border-sky-300'
                        : isDark
                        ? 'bg-rose-500/15 text-rose-300 border-rose-400/25'
                        : 'bg-rose-50 text-rose-700 border-rose-200';

                    return (
                      <article
                        key={tx.id}
                        className={`rounded-xl p-3 transition-all border ${
                          isDark
                            ? 'bg-[#0B1526]/85 border-white/10 hover:border-white/20'
                            : 'bg-white/90 border-slate-300/85 hover:border-slate-400 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Directional Icon Box */}
                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                tx.isCredit
                                  ? isDark
                                    ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-400'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : isDark
                                  ? 'bg-slate-800/90 border-white/10 text-slate-300'
                                  : 'bg-slate-100 border-slate-300 text-slate-700'
                              }`}
                            >
                              {tx.category === 'Winnings' ? (
                                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                              ) : tx.isCredit ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p
                                className={`text-xs font-bold tracking-tight truncate ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {tx.title}
                              </p>

                              {/* Meta Row: Pill Badge + Time + Copyable Reference ID / UTR */}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${pillStyles}`}
                                >
                                  {tx.badgeText}
                                </span>
                                <span
                                  className={`text-[10px] ${
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                  }`}
                                >
                                  {tx.time}
                                </span>
                                <span className="text-slate-600">•</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUtr(tx.utr)}
                                  title="Copy Reference ID"
                                  className={`inline-flex items-center gap-1 font-mono text-[10px] transition-colors cursor-pointer ${
                                    isDark
                                      ? 'text-slate-400 hover:text-sky-300'
                                      : 'text-slate-500 hover:text-sky-700'
                                  }`}
                                >
                                  <span>{tx.utr}</span>
                                  {copiedId === tx.utr ? (
                                    <Check className="h-2.5 w-2.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-2.5 w-2.5 opacity-70" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Formatted Amount */}
                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-black tracking-tight ${
                                tx.isCredit
                                  ? isDark
                                    ? 'text-emerald-400'
                                    : 'text-emerald-600'
                                  : isDark
                                  ? 'text-slate-200'
                                  : 'text-slate-900'
                              }`}
                            >
                              {tx.isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                            </span>
                            <span
                              className={`block text-[9px] font-semibold ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                              }`}
                            >
                              {tx.category === 'Entry' ? 'Deposit Bal' : 'Verified'}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Compact Tournaments Tab Preview */}
          {activeTab === 'tournaments' && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${
                isDark
                  ? 'bg-[#0B1526]/90 border-white/10'
                  : 'bg-white/90 border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-extrabold">Free Fire Lobbies Active</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Back to Wallet
                </button>
              </div>
              <p
                className={`text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Your ₹{totalBalance} balance is ready for instant entry into Bermuda &amp; Clash Squad custom rooms.
              </p>
            </div>
          )}

          {/* Compact Profile Tab Preview */}
          {activeTab === 'profile' && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${
                isDark
                  ? 'bg-[#0B1526]/90 border-white/10'
                  : 'bg-white/90 border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00C2FF] to-amber-400 text-slate-950 font-black text-xs">
                    EP
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold">Erik Padamans</h2>
                    <p
                      className={`text-[11px] ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      Linked UPI: {upiId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Open Wallet
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 8. BOTTOM NAVIGATION BAR (EXACT 3 TABS - CUPERTINO FROSTED DOCK) */}
        <nav
          aria-label="Bottom Navigation"
          className={`absolute bottom-3 inset-x-4 z-30 rounded-2xl px-2 py-1.5 border transition-all ${
            isDark
              ? 'bg-slate-950/80 backdrop-blur-xl border-white/15 shadow-2xl shadow-black/80'
              : 'bg-white/85 backdrop-blur-xl border-slate-900/10 shadow-xl shadow-slate-900/10'
          }`}
        >
          <div className="grid grid-cols-3 gap-1">
            {/* Tab 1: Tournaments */}
            <button
              type="button"
              onClick={() => setActiveTab('tournaments')}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'tournaments'
                  ? isDark
                    ? 'bg-amber-400/15 text-[#FFD000]'
                    : 'bg-slate-900 text-[#FFD000]'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gamepad2 className="h-4 w-4 shrink-0" />
              <span>Tournaments</span>
              {activeTab === 'tournaments' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-[#FFD000] shadow-[0_0_8px_#FFD000]" />
              )}
            </button>

            {/* Tab 2: Wallet (ACTIVE WITH GLOWING CYBER GOLD #FFD000 HIGHLIGHT) */}
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'wallet'
                  ? isDark
                    ? 'bg-amber-400/15 text-[#FFD000]'
                    : 'bg-slate-900 text-[#FFD000]'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="h-4 w-4 shrink-0" />
              <span>Wallet</span>
              <span
                className={`rounded px-1 py-0.2 text-[9px] font-extrabold ${
                  activeTab === 'wallet'
                    ? 'bg-[#FFD000] text-slate-950'
                    : isDark
                    ? 'bg-slate-800 text-amber-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                ₹{totalBalance}
              </span>
              {activeTab === 'wallet' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-[#FFD000] shadow-[0_0_8px_#FFD000]" />
              )}
            </button>

            {/* Tab 3: Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'profile'
                  ? isDark
                    ? 'bg-amber-400/15 text-[#FFD000]'
                    : 'bg-slate-900 text-[#FFD000]'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-sky-500/25 border border-sky-400/50 text-[8px] font-black text-sky-300">
                <User className="h-3 w-3" />
              </span>
              <span>Profile</span>
              {activeTab === 'profile' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-[#FFD000] shadow-[0_0_8px_#FFD000]" />
              )}
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}