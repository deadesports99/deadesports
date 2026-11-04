import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Bell,
  Plus,
  Lock,
  Trophy,
  Clock,
  MapPin,
  Crosshair,
  Users,
  Gamepad2,
  Wallet,
  User,
  Sun,
  Moon,
  CheckCircle2,
  Sparkles,
  Flame,
  Swords,
} from '../icons/tg-icons';

type FilterCategory = 'All Matches' | 'Solo' | 'Duo' | 'Squad' | 'Clash Squad (CS)';
type NavTab = 'tournaments' | 'wallet' | 'profile';

interface TournamentMatch {
  id: string;
  title: string;
  map: 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine';
  category: Exclude<FilterCategory, 'All Matches'>;
  modeBadge: string;
  time: string;
  prizePool: number;
  perKill: number;
  entryFee: number;
  filledSlots: number;
  totalSlots: number;
}

const INITIAL_MATCHES: TournamentMatch[] = [
  {
    id: 'ff-m1',
    title: 'Bermuda Pro Scrims #42',
    map: 'Bermuda',
    category: 'Squad',
    modeBadge: 'SQUAD 4v4',
    time: 'Today, 09:30 PM',
    prizePool: 1200,
    perKill: 20,
    entryFee: 30,
    filledSlots: 38,
    totalSlots: 48,
  },
  {
    id: 'ff-m2',
    title: 'Purgatory Lone Wolf Cup',
    map: 'Purgatory',
    category: 'Solo',
    modeBadge: 'SOLO',
    time: 'Today, 10:15 PM',
    prizePool: 800,
    perKill: 15,
    entryFee: 20,
    filledSlots: 44,
    totalSlots: 48,
  },
  {
    id: 'ff-m3',
    title: 'Clash Squad Headshot Only',
    map: 'Kalahari',
    category: 'Clash Squad (CS)',
    modeBadge: 'CS 4v4 CUSTOM',
    time: 'Today, 11:00 PM',
    prizePool: 600,
    perKill: 0,
    entryFee: 50,
    filledSlots: 6,
    totalSlots: 8,
  },
  {
    id: 'ff-m4',
    title: 'Bermuda Duo Rush Series',
    map: 'Bermuda',
    category: 'Duo',
    modeBadge: 'DUO 2v2',
    time: 'Tomorrow, 06:00 PM',
    prizePool: 1000,
    perKill: 18,
    entryFee: 25,
    filledSlots: 29,
    totalSlots: 48,
  },
];

const GAME_RIBBON = [
  {
    id: 'free-fire-max',
    name: 'FREE FIRE MAX',
    tag: 'LIVE',
    unlocked: true,
    accent: 'from-sky-500/30 via-amber-400/20 to-slate-900/90',
  },
  {
    id: 'bgmi',
    name: 'BGMI',
    tag: 'COMING SOON',
    unlocked: false,
    accent: 'from-slate-800/60 to-slate-950/90',
  },
  {
    id: 'codm',
    name: 'COD MOBILE',
    tag: 'SOON',
    unlocked: false,
    accent: 'from-slate-800/60 to-slate-950/90',
  },
  {
    id: 'valorant',
    name: 'VALORANT M',
    tag: 'LOCKED',
    unlocked: false,
    accent: 'from-slate-800/60 to-slate-950/90',
  },
];

const FILTER_PILLS: FilterCategory[] = [
  'All Matches',
  'Solo',
  'Duo',
  'Squad',
  'Clash Squad (CS)',
];

export default function FreeFireTournamentHome() {
  // Theme & Navigation State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('tournaments');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All Matches');

  // Interactive Wallet, Notifications & Match Registration State
  const [walletBalance, setWalletBalance] = useState<number>(420);
  const [hasUnreadNotif, setHasUnreadNotif] = useState<boolean>(true);
  const [matches, setMatches] = useState<TournamentMatch[]>(INITIAL_MATCHES);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [heroJoined, setHeroJoined] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Countdown Timer for Hero Banner (01:24:10 = 5050 seconds)
  const [heroSeconds, setHeroSeconds] = useState<number>(5050);

  const isDark = theme === 'dark';

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSeconds((prev) => (prev > 0 ? prev - 1 : 5050));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedHeroTimer = useMemo(() => {
    const hrs = Math.floor(heroSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const mins = Math.floor((heroSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const secs = (heroSeconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }, [heroSeconds]);

  const filteredMatches = useMemo(() => {
    if (selectedFilter === 'All Matches') return matches;
    return matches.filter((m) => m.category === selectedFilter);
  }, [matches, selectedFilter]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  const handleQuickAddFunds = () => {
    setWalletBalance((prev) => prev + 100);
    triggerToast('₹100 added to your Arena Wallet!');
  };

  const handleJoinMatch = (match: TournamentMatch) => {
    if (joinedIds.includes(match.id)) {
      triggerToast(`Already registered in ${match.title}`);
      return;
    }
    if (walletBalance < match.entryFee) {
      triggerToast('Insufficient balance! Tap + on wallet to add ₹100.');
      return;
    }
    setWalletBalance((prev) => prev - match.entryFee);
    setJoinedIds((prev) => [...prev, match.id]);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === match.id
          ? { ...m, filledSlots: Math.min(m.totalSlots, m.filledSlots + 1) }
          : m
      )
    );
    triggerToast(`Slot confirmed for ${match.title} (-₹${match.entryFee})`);
  };

  const handleJoinHeroCup = () => {
    if (heroJoined) {
      triggerToast('You are already registered for Bermuda Grand Cup #104');
      return;
    }
    if (walletBalance < 50) {
      triggerToast('Insufficient balance! Tap + on wallet to top up.');
      return;
    }
    setWalletBalance((prev) => prev - 50);
    setHeroJoined(true);
    triggerToast('Registered in BERMUDA GRAND CUP #104 (-₹50)');
  };

  return (
    <div
      className={`relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 transition-colors duration-500 overflow-hidden select-none ${
        isDark ? 'bg-[#081326] text-white' : 'bg-[#DCE4EE] text-slate-900'
      }`}
    >
      {/* Ambient Outer Background Mesh & Perspective Esports Grid */}
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

      {/* Floating Live Theme Switcher (Top-Right) */}
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

      {/* Main Mobile App Container with Strict Dual-Theme Glassmorphism */}
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
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(0,194,255,0.22),_rgba(15,23,42,0.85)_65%,_transparent_100%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.25),_rgba(241,245,249,0.7)_65%,_transparent_100%)]'
            }`}
          />
          <svg
            viewBox="0 0 430 220"
            fill="none"
            className="absolute inset-0 h-full w-full opacity-60"
          >
            <circle cx="340" cy="28" r="1.4" fill="#38BDF8" />
            <circle cx="280" cy="45" r="1.1" fill="#FACC15" />
            <circle cx="390" cy="62" r="1.5" fill="#7DD3FC" />
            <circle cx="210" cy="22" r="1.2" fill="#E0F2FE" />
            <path
              d="M260 10L395 85"
              stroke="#38BDF8"
              strokeOpacity="0.25"
              strokeWidth="0.75"
              strokeDasharray="3 5"
            />
          </svg>
        </div>

        {/* Floating Feedback Toast */}
        {toastMessage && (
          <div className="absolute top-16 inset-x-5 z-40 flex items-center justify-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md border transition-all ${
                isDark
                  ? 'bg-slate-950/90 text-emerald-300 border-emerald-400/30 shadow-black/60'
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
          {/* Left: Spartan Hexagonal Crest Badge + Title */}
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
                <span
                  className={`text-[13px] font-extrabold tracking-wider uppercase ${ isDark ? 'text-white' : 'text-slate-900' }`} > FREE FIRE ARENA </span> <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" /> </div> <p className={`text-[10px] font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Verified Esports Organiser
              </p>
            </div>
          </div>

          {/* Right: Notification Bell + Compact Wallet Pill */}
          <div className="flex items-center gap-2">
            {/* Notification Bell with Glowing Unread Dot */}
            <button
              type="button"
              onClick={() => {
                setHasUnreadNotif(false);
                triggerToast('Room ID & Password will be shared 15 mins before match.');
              }}
              aria-label="Notifications"
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-[#0B1526]/80 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                  : 'bg-white/90 border-slate-300/80 text-slate-700 hover:text-slate-950'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              {hasUnreadNotif && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_6px_#FFD000]" />
                </span>
              )}
            </button>

            {/* Compact Wallet Balance Pill ("₹420" + '+') */}
            <div
              className={`flex items-center gap-1.5 rounded-lg pl-2.5 pr-1 py-1 border transition-all ${
                isDark
                  ? 'bg-[#0B1526]/90 border-amber-400/30 text-white'
                  : 'bg-slate-900 border-amber-500/40 text-white shadow-xs'
              }`}
            >
              <Wallet className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-xs font-extrabold tracking-tight text-amber-300">
                ₹{walletBalance}
              </span>
              <button
                type="button"
                onClick={handleQuickAddFunds}
                title="Instant Add ₹100"
                aria-label="Add funds"
                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[#FFD000] hover:bg-[#FFDA29] active:scale-90 text-slate-950 transition-all cursor-pointer"
              >
                <Plus className="h-3 w-3 stroke-[3]" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <div className="relative z-10 px-4 pt-3.5 pb-24 space-y-4">
          {activeTab === 'tournaments' && (
            <>
              {/* 4. GAMES SELECTOR RIBBON (FREE FIRE OPEN, OTHERS LOCKED) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${ isDark ? 'text-slate-400' : 'text-slate-500' }`} > Select Esports Title </span> <span className={`text-[10px] font-semibold ${
                      isDark ? 'text-sky-400' : 'text-sky-600'
                    }`}
                  >
                    1 Active • 3 Locked
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {GAME_RIBBON.map((game) => {
                    if (game.unlocked) {
                      return (
                        <button
                          key={game.id}
                          type="button"
                          className={`relative flex flex-col justify-between rounded-xl p-2 text-left transition-all cursor-pointer bg-gradient-to-br ${game.accent} border-2 border-amber-400 ring-2 ring-amber-400/25 shadow-[0_0_15px_rgba(0,194,255,0.22)]`} > <div className="flex items-center justify-between w-full"> <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/40"> <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> {game.tag} </span> <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" /> </div> <div className="mt-2.5"> <p className="text-[10px] font-black leading-tight tracking-tight text-white"> {game.name} </p> </div> </button> ); }  return ( <button key={game.id} type="button" onClick={() => triggerToast(`${game.name} tournaments are launching soon!`)
                        }
                        className={`relative flex flex-col justify-between rounded-xl p-2 text-left opacity-40 hover:opacity-55 transition-opacity cursor-not-allowed border ${
                          isDark
                            ? 'bg-[#0B1526]/70 border-white/10 text-slate-300'
                            : 'bg-slate-200/80 border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`rounded px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider ${
                              isDark
                                ? 'bg-slate-800 text-slate-300 border border-white/10'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {game.tag}
                          </span>
                          <Lock className="h-3 w-3 shrink-0" />
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[10px] font-bold leading-tight truncate">
                            {game.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. COMPACT TOURNAMENT FILTER PILLS */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {FILTER_PILLS.map((pill) => {
                  const isActive = selectedFilter === pill;
                  return (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => setSelectedFilter(pill)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer border ${
                        isActive
                          ? isDark
                            ? 'bg-amber-400/15 border-[#FFD000] text-[#FFD000] shadow-[0_0_10px_rgba(255,208,0,0.2)]'
                            : 'bg-slate-900 border-[#FFD000] text-[#FFD000] shadow-xs'
                          : isDark
                          ? 'bg-[#0B1526]/80 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                          : 'bg-white/80 border-slate-300/80 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {pill}
                    </button>
                  );
                })}
              </div>

              {/* 6. FEATURED HERO TOURNAMENT BANNER (COMPACT) */}
              <section
                className={`relative overflow-hidden rounded-2xl p-3.5 border transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-[#0B192E] via-[#102644] to-[#0B1526] border-sky-400/30 shadow-lg shadow-sky-950/50'
                    : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white shadow-md'
                }`}
              >
                {/* Decorative Cyber Glow */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#00C2FF]/20 blur-2xl" />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-[#00C2FF]/20 border border-[#00C2FF]/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#00C2FF]">
                        <Sparkles className="h-2.5 w-2.5" />
                        Featured Marquee
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-950/70 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-300">
                        <Clock className="h-2.5 w-2.5 text-amber-400" />
                        Starts in {formattedHeroTimer}
                      </span>
                    </div>

                    <h2 className="text-sm font-black tracking-tight text-white truncate">
                      BERMUDA GRAND CUP #104
                    </h2>

                    <div className="flex items-center gap-3 text-[11px] text-slate-300">
                      <span className="inline-flex items-center gap-1 font-bold text-[#FFD000]">
                        <Trophy className="h-3 w-3" />
                        Prize Pool: ₹5,000
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="font-medium text-sky-300">Entry: ₹50</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleJoinHeroCup}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-all active:scale-[0.96] cursor-pointer shadow-md ${
                      heroJoined
                        ? 'bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-[#FFD000] hover:bg-[#FFDA29] text-slate-950 shadow-amber-400/25'
                    }`}
                  >
                    {heroJoined ? 'Joined ✓' : 'Join Now'}
                  </button>
                </div>
              </section>

              {/* 7. TOURNAMENT MATCH CARDS LIST (THE CORE CONTENT) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-xs font-extrabold uppercase tracking-wider ${ isDark ? 'text-slate-200' : 'text-slate-800' }`} > Upcoming Matches ({filteredMatches.length}) </h3> <span className={`text-[10px] font-medium ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Instant Room ID • Auto Payout
                  </span>
                </div>

                {filteredMatches.map((match) => {
                  const isJoined = joinedIds.includes(match.id);
                  const fillPercent = Math.round(
                    (match.filledSlots / match.totalSlots) * 100
                  );

                  return (
                    <article
                      key={match.id}
                      className={`rounded-2xl p-3.5 transition-all border ${
                        isDark
                          ? 'bg-[#0B1526]/85 border-white/10 hover:border-white/20'
                          : 'bg-white/90 border-slate-300/85 hover:border-slate-400 shadow-xs'
                      }`}
                    >
                      {/* Card Header: Map Tag + Mode Badge + Match Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              isDark
                                ? 'bg-slate-800/90 border-white/10 text-sky-300'
                                : 'bg-sky-50 border-sky-200 text-sky-800'
                            }`}
                          >
                            <MapPin className="h-2.5 w-2.5 text-[#00C2FF]" />
                            {match.map}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${
                              isDark
                                ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-800'
                            }`}
                          >
                            <Swords className="h-2.5 w-2.5" />
                            {match.modeBadge}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-semibold shrink-0 ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {match.time}
                        </span>
                      </div>

                      {/* Match Title */}
                      <p
                        className={`mt-2 text-[13px] font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {match.title}
                      </p>

                      {/* Metrics Row: Prize Pool, Per Kill, Entry Fee */}
                      <div
                        className={`mt-2.5 grid grid-cols-3 gap-2 rounded-xl px-3 py-2 border ${
                          isDark
                            ? 'bg-slate-900/75 border-white/5'
                            : 'bg-slate-100/90 border-slate-200/80'
                        }`}
                      >
                        <div>
                          <span
                            className={`block text-[9px] uppercase font-semibold ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Prize Pool
                          </span>
                          <span
                            className={`text-xs font-extrabold ${
                              isDark ? 'text-amber-400' : 'text-amber-600'
                            }`}
                          >
                            ₹{match.prizePool.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="border-x border-white/10 px-2">
                          <span
                            className={`block text-[9px] uppercase font-semibold ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Per Kill
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-extrabold ${ isDark ? 'text-sky-300' : 'text-sky-700' }`} > <Crosshair className="h-3 w-3 text-[#00C2FF]" /> {match.perKill > 0 ? `₹${match.perKill} / Kill` : 'Win Only'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`block text-[9px] uppercase font-semibold ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Entry Fee
                          </span>
                          <span
                            className={`text-xs font-extrabold ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            ₹{match.entryFee}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Live Slots Progress Bar + Compact Join CTA */}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                            <span
                              className={`inline-flex items-center gap-1 ${ isDark ? 'text-slate-300' : 'text-slate-700' }`} > <Users className="h-3 w-3 text-[#00C2FF]" /> {match.filledSlots} / {match.totalSlots} Slots Filled </span> <span className={`font-bold ${
                                fillPercent >= 80 ? 'text-amber-400' : 'text-sky-400'
                              }`}
                            >
                              {match.totalSlots - match.filledSlots} left
                            </span>
                          </div>

                          {/* Dual-Color Gradient Progress Bar (Cyan to Amber) */}
                          <div
                            className={`h-1.5 w-full rounded-full overflow-hidden ${ isDark ? 'bg-slate-800' : 'bg-slate-200' }`} > <div style={{ width: `${fillPercent}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-[#00C2FF] via-sky-400 to-[#FFD000] transition-all duration-300"
                            />
                          </div>
                        </div>

                        {/* Compact Cyber Gold Action Button (py-1.5 px-3) */}
                        <button
                          type="button"
                          onClick={() => handleJoinMatch(match)}
                          className={`shrink-0 rounded-lg py-1.5 px-3 text-[11px] font-extrabold transition-all duration-150 active:scale-[0.96] cursor-pointer shadow-md ${
                            isJoined
                              ? 'bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-[#FFD000] hover:bg-[#FFDA29] text-slate-950 shadow-amber-400/20'
                          }`}
                        >
                          {isJoined ? 'Joined ✓' : `Join Slot • ₹${match.entryFee}`}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* Compact Wallet Tab Preview */}
          {activeTab === 'wallet' && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${ isDark ? 'bg-[#0B1526]/90 border-white/10' : 'bg-white/90 border-slate-300' }`} > <div className="flex items-center justify-between"> <div> <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400"> Instant UPI Wallet </span> <h2 className="text-xl font-black mt-0.5">₹{walletBalance}</h2> </div> <button type="button" onClick={handleQuickAddFunds} className="rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer" > + Add ₹100 </button> </div> <p className={`text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Winnings are credited immediately after match verification. Switch back to the Tournaments tab to join open lobbies.
              </p>
            </div>
          )}

          {/* Compact Profile Tab Preview */}
          {activeTab === 'profile' && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${ isDark ? 'bg-[#0B1526]/90 border-white/10' : 'bg-white/90 border-slate-300' }`} > <div className="flex items-center gap-3"> <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#00C2FF] to-amber-400 text-slate-950 font-black text-sm"> EP </div> <div> <h2 className="text-sm font-extrabold">Erik Padamans</h2> <p className={`text-[11px] ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Free Fire UID: 582910442 • Joined Matches: {joinedIds.length + (heroJoined ? 1 : 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8. BOTTOM NAVIGATION BAR (EXACTLY 3 TABS - CUPERTINO FROSTED DOCK) */}
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
                    ? 'bg-amber-400/15 text-[#FFD000] border border-amber-400/30 shadow-[0_0_12px_rgba(255,208,0,0.2)]'
                    : 'bg-slate-900 text-[#FFD000] shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Tournaments</span>
            </button>

            {/* Tab 2: Wallet */}
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'wallet'
                  ? isDark
                    ? 'bg-amber-400/15 text-[#FFD000] border border-amber-400/30 shadow-[0_0_12px_rgba(255,208,0,0.2)]'
                    : 'bg-slate-900 text-[#FFD000] shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Wallet</span>
            </button>

            {/* Tab 3: Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'profile'
                  ? isDark
                    ? 'bg-amber-400/15 text-[#FFD000] border border-amber-400/30 shadow-[0_0_12px_rgba(255,208,0,0.2)]'
                    : 'bg-slate-900 text-[#FFD000] shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}
