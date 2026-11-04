import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Trophy,
  Crosshair,
  Flame,
  Gamepad2,
  Wallet,
  User,
  Sun,
  Moon,
  Lock,
  LogOut,
  Phone,
  CheckCircle2,
  X,
  MessageSquare,
  FileText,
  Info,
  Sparkles,
  KeyRound,
  ChevronRight,
  Award,
  AlertTriangle,
} from '../icons/tg-icons';

type NavTab = 'tournaments' | 'wallet' | 'profile';
type AuthProvider = 'google' | 'phone';

export default function FreeFireProfileScreen() {
  // Core Theme & Bottom Navigation State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('profile');
  const isDark = theme === 'dark';

  // Interactive Auth Provider Demo State ('google' | 'phone')
  const [provider, setProvider] = useState<AuthProvider>('google');

  // Interactive Drawers & Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState<boolean>(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState<boolean>(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    'about' | 'rules' | null
  >('rules');

  // Account Security PIN / Password State
  const [securityPin, setSecurityPin] = useState<string>('4829');
  const [newPassword, setNewPassword] = useState<string>('');

  // Feedback Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2700);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPin.length < 4) {
      triggerToast('Security PIN must be 4 digits.');
      return;
    }
    setIsSecurityOpen(false);
    setNewPassword('');
    triggerToast('Account Security PIN & Password updated!');
  };

  const handleConfirmSignOut = () => {
    setIsSignOutOpen(false);
    triggerToast('Signed out safely. Redirecting to Arena Login...');
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

      {/* Main Profile Container with Strict Dual-Theme Glassmorphism */}
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
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(0,194,255,0.22),_rgba(255,208,0,0.12)_48%,_transparent_100%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.24),_rgba(251,191,36,0.15)_48%,_transparent_100%)]'
            }`}
          />
          <svg
            viewBox="0 0 430 220"
            fill="none"
            className="absolute inset-0 h-full w-full opacity-60"
          >
            <circle cx="350" cy="24" r="1.4" fill="#38BDF8" />
            <circle cx="285" cy="42" r="1.2" fill="#FACC15" />
            <circle cx="395" cy="64" r="1.5" fill="#7DD3FC" />
            <circle cx="215" cy="20" r="1.1" fill="#E0F2FE" />
            <path
              d="M270 12L400 88"
              stroke="#38BDF8"
              strokeOpacity="0.25"
              strokeWidth="0.75"
              strokeDasharray="3 5"
            />
          </svg>
        </div>

        {/* Floating Feedback Toast */}
        {toastMessage && (
          <div className="absolute top-16 inset-x-5 z-50 flex items-center justify-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md border transition-all ${
                isDark
                  ? 'bg-slate-950/95 text-emerald-300 border-emerald-400/35 shadow-black/60'
                  : 'bg-slate-900 text-emerald-300 border-emerald-400/40 shadow-slate-900/20'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* 3. TOP APP HEADER */}
        <header
          className={`relative z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b ${
            isDark ? 'border-white/10' : 'border-slate-900/10'
          }`}
        >
          {/* Left: Spartan Hexagonal Crest Badge + Title "PLAYER PROFILE" */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1 rounded-full bg-sky-500/20 blur-xs" />
              <svg
                width="34"
                height="36"
                viewBox="0 0 64 68"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative drop-shadow-[0_2px_8px_rgba(0,194,255,0.35)]"
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
                  PLAYER PROFILE
                </h1>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              </div>
              <p
                className={`text-[10px] font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Season 6 • Verified Competitor
              </p>
            </div>
          </div>

          {/* Right: Sleek Settings Gear Icon (⚙️) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open Settings"
            className={`group flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-[#0B1526]/90 border-white/10 text-slate-200 hover:border-amber-400/50 hover:text-white'
                : 'bg-white/90 border-slate-300/85 text-slate-800 hover:border-slate-400 shadow-2xs'
            }`}
          >
            <Settings className="h-3.5 w-3.5 text-amber-400 transition-transform duration-300 group-hover:rotate-90" />
            <span>Settings</span>
          </button>
        </header>

        {/* Scrollable Content Viewport */}
        <div className="relative z-10 px-4 pt-3.5 pb-24 space-y-4">
          {activeTab === 'profile' && (
            <>
              {/* 4. GAMER IDENTITY & PROVIDER CARD */}
              <section
                className={`relative overflow-hidden rounded-2xl p-4 border transition-all ${
                  isDark
                    ? 'bg-gradient-to-br from-[#0D1B32]/95 via-[#0B1526]/95 to-[#091220]/95 border-white/10 shadow-xl shadow-black/50'
                    : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white shadow-lg'
                }`}
              >
                {/* Ambient Glow */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#00C2FF]/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#FFD000]/15 blur-2xl" />

                {/* Top Demo Switcher Row: Switch between "Google Login" and "Phone Login" */}
                <div className="relative z-10 flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Auth Identity Mode
                  </span>

                  <div className="inline-flex rounded-lg p-0.5 text-[10px] font-bold bg-slate-950/80 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setProvider('google')}
                      className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                        provider === 'google'
                          ? 'bg-[#00C2FF] text-slate-950 font-extrabold shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Google Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('phone')}
                      className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                        provider === 'phone'
                          ? 'bg-[#FFD000] text-slate-950 font-extrabold shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Phone Login
                    </button>
                  </div>
                </div>

                {/* Avatar + Gamer Identity Row */}
                <div className="relative z-10 flex items-center gap-3.5">
                  {/* Dynamic Avatar based on Provider */}
                  <div className="relative shrink-0">
                    {provider === 'google' ? (
                      /* High-Res Esports Pro Avatar for Google Auth */
                      <div className="relative h-14 w-14 rounded-2xl overflow-hidden border-2 border-[#00C2FF] shadow-[0_0_15px_rgba(0,194,255,0.35)] bg-slate-950">
                        <svg
                          viewBox="0 0 64 64"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-full w-full"
                        >
                          <rect width="64" height="64" fill="url(#avatarGrad)" />
                          {/* Pro Gamer Hooded Silhouette */}
                          <path
                            d="M14 58C16 44 24 38 32 38C40 38 48 44 50 58H14Z"
                            fill="#0F172A"
                          />
                          <circle cx="32" cy="24" r="11" fill="#E2E8F0" />
                          {/* Cyber Visor */}
                          <rect
                            x="23"
                            y="21"
                            width="18"
                            height="5"
                            rx="2.5"
                            fill="#00C2FF"
                          />
                          {/* Headset */}
                          <path
                            d="M19 24C19 16.8 24.8 11 32 11C39.2 11 45 16.8 45 24"
                            stroke="#FFD000"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          <rect
                            x="17"
                            y="20"
                            width="4"
                            height="9"
                            rx="2"
                            fill="#FFD000"
                          />
                          <rect
                            x="43"
                            y="20"
                            width="4"
                            height="9"
                            rx="2"
                            fill="#FFD000"
                          />
                          <defs>
                            <linearGradient
                              id="avatarGrad"
                              x1="0"
                              y1="0"
                              x2="64"
                              y2="64"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#0284C7" />
                              <stop offset="1" stopColor="#0F172A" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    ) : (
                      /* Glowing "EP" Esports Initials Avatar for Phone Auth */
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-sky-500 p-0.5 shadow-[0_0_16px_rgba(255,208,0,0.35)]">
                        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#091326]">
                          <span className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FFD000] to-[#00C2FF]">
                            EP
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Small Provider Badge Overlay (Google 'G' or Phone Icon) */}
                    <div
                      className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0B1526] shadow-md ${
                        provider === 'google' ? 'bg-white' : 'bg-[#FFD000]'
                      }`}
                    >
                      {provider === 'google' ? (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                          <path
                            fill="#EA4335"
                            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.4 0 10.6 0 12s.6 3.6 1.6 5.6l3.7-2.8z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
                          />
                        </svg>
                      ) : (
                        <Phone className="h-3 w-3 text-slate-950 stroke-[2.5]" />
                      )}
                    </div>
                  </div>

                  {/* Player IGN & Provider Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-base font-black tracking-tight text-white truncate">
                        Erik Padamans
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#FFD000]">
                        <Sparkles className="h-2.5 w-2.5" />
                        Booyah Verified
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-sky-300 truncate">
                      {provider === 'google'
                        ? 'Google: erik.padamans@gmail.co'
                        : 'Logged in via Phone: +91 99999 00001'}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <ShieldCheck className="h-3 w-3" />
                        Anti-Cheat Clear
                      </span>
                      <span>•</span>
                      <span>Tier: Grandmaster IV</span>
                    </div>
                  </div>
                </div>

                {/* Compact Action Buttons: Account Security & Sign Out */}
                <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSecurityOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-1.5 px-3 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-400/20 transition-all cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Account Security</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignOutOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-950/80 active:scale-[0.96] py-1.5 px-3 text-xs font-bold text-slate-200 hover:text-rose-200 border border-white/10 hover:border-rose-400/40 transition-all cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </section>

              {/* 5. ESPORTS CAREER STATS SHOWCASE (THE CORE METRIC GRID) */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    Esports Career Stats
                  </h3>
                  <span
                    className={`text-[10px] font-semibold ${
                      isDark ? 'text-sky-400' : 'text-sky-700'
                    }`}
                  >
                    Free Fire Max • Official Scrims
                  </span>
                </div>

                {/* 2x2 High-Impact Glassmorphic Stats Matrix */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Stat 1: Matches Played */}
                  <div
                    className={`rounded-2xl p-3.5 border transition-all ${
                      isDark
                        ? 'bg-[#0B1526]/85 border-white/10 hover:border-sky-400/30'
                        : 'bg-white/90 border-slate-300/85 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Matches Played
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-400/30 text-[#00C2FF]">
                        <Trophy className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p
                      className={`mt-1.5 text-xl font-black tracking-tight ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      48
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] font-medium ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      100% Lobby Completion
                    </p>
                  </div>

                  {/* Stat 2: Total Kills */}
                  <div
                    className={`rounded-2xl p-3.5 border transition-all ${
                      isDark
                        ? 'bg-[#0B1526]/85 border-white/10 hover:border-sky-400/30'
                        : 'bg-white/90 border-slate-300/85 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Total Kills
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-400">
                        <Crosshair className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <p
                        className={`text-xl font-black tracking-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        142
                      </p>
                      <span className="rounded bg-emerald-500/15 border border-emerald-400/30 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400">
                        2.96 K/D
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-[10px] font-medium ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Avg. 3.0 Kills / Match
                    </p>
                  </div>

                  {/* Stat 3: Booyah / Win Rate */}
                  <div
                    className={`rounded-2xl p-3.5 border transition-all ${
                      isDark
                        ? 'bg-[#0B1526]/85 border-white/10 hover:border-amber-400/30'
                        : 'bg-white/90 border-slate-300/85 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Booyah / Win Rate
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400">
                        <Flame className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <p
                        className={`text-xl font-black tracking-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        28%
                      </p>
                      <span className="rounded bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-300">
                        14 Wins
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-[10px] font-medium ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Top 3 Finish: 31 Matches
                    </p>
                  </div>

                  {/* Stat 4: Total Earnings */}
                  <div
                    className={`rounded-2xl p-3.5 border transition-all ${
                      isDark
                        ? 'bg-gradient-to-br from-[#0B1526] to-[#13233F] border-amber-400/35 shadow-[0_0_15px_rgba(255,208,0,0.12)]'
                        : 'bg-slate-900 border-amber-500/50 text-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                        Total Earnings
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFD000]/20 border border-[#FFD000]/40 text-[#FFD000]">
                        <Award className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xl font-black tracking-tight text-[#FFD000] drop-shadow-[0_0_10px_rgba(255,208,0,0.4)]">
                      ₹3,450
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-emerald-300">
                      ✔ Instant UPI Credited
                    </p>
                  </div>
                </div>
              </section>

              {/* Quick Settings & Helpdesk Access Strip */}
              <section
                className={`rounded-2xl p-3 border flex items-center justify-between gap-2 ${
                  isDark
                    ? 'bg-[#0B1526]/80 border-white/10'
                    : 'bg-white/90 border-slate-300/85'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold truncate ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      Rules, Fair Play &amp; WhatsApp Helpdesk
                    </p>
                    <p
                      className={`text-[10px] truncate ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      View v2.4.0 anti-cheat policy or contact live host
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg py-1.5 px-3 text-xs font-bold bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 text-[#00C2FF] border border-[#00C2FF]/30 transition-all cursor-pointer"
                >
                  <span>Open</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
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
                  <Gamepad2 className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-extrabold">Tournament Lobbies</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Back to Profile
                </button>
              </div>
              <p
                className={`text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                48 career matches completed. Your profile is verified for all Solo, Duo, and Squad 4v4 Free Fire customs.
              </p>
            </div>
          )}

          {/* Compact Wallet Tab Preview */}
          {activeTab === 'wallet' && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${
                isDark
                  ? 'bg-[#0B1526]/90 border-white/10'
                  : 'bg-white/90 border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Career Winnings
                  </span>
                  <h2 className="text-lg font-black mt-0.5">₹3,450 Earned</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 6. INTERACTIVE SETTINGS MODAL / DRAWER (TRIGGERS FROM TOP-RIGHT ⚙️) */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/65 backdrop-blur-xs animate-fadeIn">
            <div
              className={`w-full rounded-t-[26px] p-4 border-t transition-all max-h-[86%] overflow-y-auto ${
                isDark
                  ? 'bg-slate-900/95 backdrop-blur-2xl border-white/15 text-white shadow-2xl'
                  : 'bg-white/95 backdrop-blur-xl border-slate-300 text-slate-900 shadow-2xl'
              }`}
            >
              {/* Drawer Handle & Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-extrabold tracking-tight">
                    Arena Settings &amp; Fair Play
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Close Settings"
                  className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-slate-200 text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3.5 space-y-3">
                {/* Item 1: Theme Preference Toggle Switch */}
                <div
                  className={`flex items-center justify-between rounded-xl p-3 border ${
                    isDark
                      ? 'bg-[#0B1526]/90 border-white/10'
                      : 'bg-slate-100 border-slate-300/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? (
                      <Moon className="h-4 w-4 text-sky-400" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <p className="text-xs font-bold">Theme Preference</p>
                      <p
                        className={`text-[10px] ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Currently active: {isDark ? 'Dark Frosted (50%)' : 'Light Frosted (25%)'}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex rounded-lg p-0.5 text-[10px] font-bold bg-slate-950/80 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#00C2FF] text-slate-950 font-extrabold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                        !isDark
                          ? 'bg-[#FFD000] text-slate-950 font-extrabold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Light
                    </button>
                  </div>
                </div>

                {/* Item 2: About Free Fire Arena (Version 2.4.0 & Fair Play Anti-Cheat) */}
                <div
                  className={`rounded-xl border overflow-hidden ${
                    isDark
                      ? 'bg-[#0B1526]/90 border-white/10'
                      : 'bg-slate-100 border-slate-300/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSettingsSection(
                        activeSettingsSection === 'about' ? null : 'about'
                      )
                    }
                    className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Info className="h-4 w-4 text-[#00C2FF]" />
                      <div>
                        <p className="text-xs font-bold">About Free Fire Arena</p>
                        <p
                          className={`text-[10px] ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Version 2.4.0 • Fair Play Anti-Cheat Policy
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400">
                      v2.4.0
                    </span>
                  </button>

                  {activeSettingsSection === 'about' && (
                    <div
                      className={`px-3 pb-3 pt-1 text-[11px] leading-relaxed border-t ${
                        isDark
                          ? 'border-white/5 text-slate-300'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Zero tolerance for emulators, modded APKs, or third-party scripts. All lobbies are monitored live by automated anti-cheat and replay moderators.
                    </div>
                  )}
                </div>

                {/* Item 3: Terms & Conditions & Tournament Rules */}
                <div
                  className={`rounded-xl border overflow-hidden ${
                    isDark
                      ? 'bg-[#0B1526]/90 border-white/10'
                      : 'bg-slate-100 border-slate-300/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSettingsSection(
                        activeSettingsSection === 'rules' ? null : 'rules'
                      )
                    }
                    className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="text-xs font-bold">
                          Terms &amp; Conditions &amp; Tournament Rules
                        </p>
                        <p
                          className={`text-[10px] ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Room joining rules &amp; screenshot submission guidelines
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        activeSettingsSection === 'rules' ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {activeSettingsSection === 'rules' && (
                    <ul
                      className={`px-3 pb-3 pt-1 space-y-1 text-[11px] border-t ${
                        isDark
                          ? 'border-white/5 text-slate-300'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <li>• Room ID &amp; Password are shared 15 mins prior to start.</li>
                      <li>• Minimum Level 40 Free Fire account required to join.</li>
                      <li>• Upload final Booyah scoreboard screenshot within 10 mins for disputed kills.</li>
                    </ul>
                  )}
                </div>

                {/* Item 4: Support & WhatsApp Helpdesk */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    triggerToast('Opening Official Organizer WhatsApp Helpdesk...');
                  }}
                  className="w-full flex items-center justify-between rounded-xl p-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold text-emerald-300">
                        Support &amp; WhatsApp Helpdesk
                      </p>
                      <p className="text-[10px] text-emerald-200/80">
                        Direct 24×7 live chat with tournament organizer
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-400 px-2.5 py-1 text-[10px] font-extrabold text-slate-950">
                    Chat Now
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Account Security Modal (Change Password / 4-Digit Security PIN) */}
        {isSecurityOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div
              className={`w-full rounded-2xl p-4 border space-y-3 ${
                isDark
                  ? 'bg-slate-900 border-white/15 text-white shadow-2xl'
                  : 'bg-white border-slate-300 text-slate-900 shadow-xl'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    Account Security &amp; 4-Digit PIN
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSecurityOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSecurity} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    4-Digit Withdrawal Security PIN
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    inputMode="numeric"
                    value={securityPin}
                    onChange={(e) =>
                      setSecurityPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    className="w-full rounded-lg bg-[#081120] border border-amber-400 px-3 py-2 text-xs font-mono font-extrabold tracking-widest text-white outline-none focus:ring-2 focus:ring-amber-400/40"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Update Account Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-lg bg-[#081120] border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSecurityOpen(false)}
                    className="rounded-lg py-1.5 px-3 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-1.5 px-3 text-xs font-extrabold text-slate-950 cursor-pointer"
                  >
                    Save Security Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Interactive Sign Out Confirmation Alert */}
        {isSignOutOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div
              className={`w-full rounded-2xl p-4 border space-y-3 ${
                isDark
                  ? 'bg-slate-900 border-white/15 text-white shadow-2xl'
                  : 'bg-white border-slate-300 text-slate-900 shadow-xl'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    Confirm Sign Out
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Are you sure you want to sign out of Erik Padamans?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignOutOpen(false)}
                  className="rounded-lg py-1.5 px-3 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Stay Logged In
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSignOut}
                  className="rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-[0.96] py-1.5 px-3 text-xs font-extrabold text-white cursor-pointer"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. BOTTOM NAVIGATION BAR (EXACT 3 TABS - CUPERTINO FROSTED DOCK) */}
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

            {/* Tab 2: Wallet */}
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
              {activeTab === 'wallet' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-[#FFD000] shadow-[0_0_8px_#FFD000]" />
              )}
            </button>

            {/* Tab 3: Profile (ACTIVE WITH GLOWING CYBER GOLD #FFD000 HIGHLIGHT) */}
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
              <User className="h-4 w-4 shrink-0" />
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