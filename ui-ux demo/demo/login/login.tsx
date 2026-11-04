import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  Check,
  Chrome,
  Gamepad2,
  Sun,
  Moon,
} from '../icons/tg-icons';

export default function EliteGamingArenaAuth() {
  // Core Requested State Management
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState<string>('erik.padamans@gmail.co');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(true);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const isDark = theme === 'dark';

  // Reactive Password Security Validation
  const validation = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
    return {
      hasMinLength,
      hasSpecialChar,
      isValid: email.trim().length > 3 && hasMinLength && hasSpecialChar,
    };
  }, [email, password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 2200);
  };

  return (
    <div
      className={`relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-10 transition-colors duration-500 overflow-hidden select-none ${
        isDark ? 'bg-[#081326] text-white' : 'bg-[#DCE4EE] text-slate-900'
      }`}
    >
      {/* Ambient Outer Background Mesh & Esports Grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-[130px] transition-opacity duration-700 ${
            isDark ? 'bg-sky-500/20 opacity-100' : 'bg-sky-400/30 opacity-80'
          }`}
        />
        <div
          className={`absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? 'bg-amber-500/15 opacity-100' : 'bg-amber-400/25 opacity-70'
          }`}
        />
        {/* Subtle Isometric Perspective Grid */}
        <div
          className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:36px_36px] ${
            isDark ? 'opacity-60' : 'opacity-30'
          }`}
        />
      </div>

      {/* Floating Theme Switcher (Top-Right) */}
      <div className="fixed top-5 right-5 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle color theme"
          className={`group flex items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-semibold tracking-wide transition-all duration-300 active:scale-95 ${
            isDark
              ? 'bg-slate-900/70 text-slate-100 border border-white/15 shadow-lg shadow-black/40 hover:border-amber-400/50'
              : 'bg-white/85 text-slate-800 border border-slate-900/10 shadow-lg shadow-slate-900/10 hover:border-sky-500/40'
          } backdrop-blur-xl`}
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-sky-600 transition-transform duration-300 group-hover:-rotate-12" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Main 1:1 Auth Card with Strict User Spec Dual-Theme Glassmorphism */}
      <main
        className={`relative w-full max-w-[430px] rounded-[26px] overflow-hidden transition-all duration-500 ${
          isDark
            ? 'bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/70'
            : 'bg-white/75 backdrop-blur-md border border-slate-900/10 shadow-xl shadow-slate-900/15'
        }`}
      >
        {/* Atmospheric Gamer Artwork & Starfield Header Backdrop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[330px] overflow-hidden">
          {/* Deep Radial Gradient Mesh */}
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${
              isDark
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(14,165,233,0.28),_rgba(15,23,42,0.88)_62%,_rgba(15,23,42,1)_100%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.32),_rgba(241,245,249,0.75)_65%,_rgba(255,255,255,0.95)_100%)]'
            }`}
          />

          {/* Starfield & Glowing Cyber Particles */}
          <svg
            viewBox="0 0 430 330"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 h-full w-full object-cover"
          >
            {/* Nebula & Particle Dots */}
            <g opacity={isDark ? '0.85' : '0.45'}>
              <circle cx="195" cy="36" r="1.3" fill="#7DD3FC" />
              <circle cx="240" cy="24" r="1.8" fill="#E0F2FE" />
              <circle cx="275" cy="58" r="1.2" fill="#38BDF8" />
              <circle cx="218" cy="78" r="1.5" fill="#BAE6FD" />
              <circle cx="160" cy="64" r="1.1" fill="#7DD3FC" />
              <circle cx="310" cy="30" r="1.6" fill="#FDE68A" />
              <circle cx="145" cy="110" r="1.2" fill="#38BDF8" />
              <circle cx="255" cy="108" r="1.4" fill="#E0F2FE" />
              {/* Diagonal Cosmic Light Streaks */}
              <path
                d="M170 15L290 95"
                stroke="url(#cyanGlow)"
                strokeWidth="0.75"
                strokeDasharray="3 5"
              />
              <path
                d="M235 8L370 100"
                stroke="url(#cyanGlow)"
                strokeWidth="0.75"
                strokeDasharray="2 4"
              />
            </g>

            {/* Right-Side Esports Gamer Silhouette with Glowing Cyan Headset (1:1 Mockup Detail) */}
            <g opacity={isDark ? '0.68' : '0.28'}>
              {/* Ambient Backlight Behind Gamer */}
              <circle cx="370" cy="145" r="78" fill="url(#gamerAura)" />
              {/* Hood / Hair Silhouette */}
              <path
                d="M318 112C322 74 356 54 392 60C418 64 435 88 435 126C435 162 420 202 406 232L305 232C312 204 328 188 338 168C326 154 316 134 318 112Z"
                fill={isDark ? '#0B192E' : '#334155'}
              />
              {/* Face Profile Accent */}
              <path
                d="M332 118C332 142 344 162 362 168C378 172 396 158 400 132C404 106 388 84 364 84C344 84 332 98 332 118Z"
                fill={isDark ? '#162A47' : '#475569'}
              />
              {/* Headphone Band */}
              <path
                d="M342 74C364 56 402 64 412 96"
                stroke="#38BDF8"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* Glowing Cyan Headphone Earcup Ring (Iconic Circle at Right of Card) */}
              <circle
                cx="392"
                cy="126"
                r="16"
                fill={isDark ? '#091930' : '#1E293B'}
                stroke="#00D2FF"
                strokeWidth="4.5"
              />
              <circle cx="392" cy="126" r="7" fill="#38BDF8" fillOpacity="0.6" />
              {/* Headset Mic Boom */}
              <path
                d="M378 136C364 148 346 152 332 148"
                stroke="#00D2FF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>

            <defs>
              <linearGradient id="cyanGlow" x1="170" y1="15" x2="370" y2="100" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" stopOpacity="0" />
                <stop offset="0.5" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="gamerAura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(370 145) scale(78)">
                <stop stopColor="#00D2FF" stopOpacity="0.45" />
                <stop offset="1" stopColor="#00D2FF" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Bottom Fade into Form Container */}
          <div
            className={`absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t ${
              isDark ? 'from-[#0D182B] via-[#0D182B]/80 to-transparent' : 'from-white/90 via-white/60 to-transparent'
            }`}
          />
        </div>

        {/* Inner Content Container */}
        <div className="relative z-10 px-7 pt-7 pb-8 sm:px-8">
          {/* Top Bar: Back to home + Mode/Tournament Pill */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              className={`group inline-flex items-center gap-2 text-xs font-medium tracking-wide transition-colors ${
                isDark
                  ? 'text-slate-300/90 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back to home</span>
            </button>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                isDark
                  ? 'bg-amber-400/10 text-amber-300 border-amber-400/25'
                  : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
              }`}
            >
              <Shield className="h-2.5 w-2.5" />
              Free Fire Tournament
            </span>
          </div>

          {/* Hexagonal Esports Crest / Shield Emblem */}
          <div className="mt-7 mb-4 flex items-center justify-between">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute -inset-2 rounded-full bg-sky-500/20 blur-md" />
              <svg
                width="58"
                height="62"
                viewBox="0 0 64 68"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative drop-shadow-[0_6px_16px_rgba(0,180,216,0.35)]"
              >
                {/* Outer Shield Crest */}
                <path
                  d="M32 3L57 13.5V33.5C57 49.5 46.2 60.8 32 65C17.8 60.8 7 49.5 7 33.5V13.5L32 3Z"
                  fill="#0B192E"
                  stroke="url(#shieldBorder)"
                  strokeWidth="2.5"
                />
                {/* Inner Hexagonal Accent */}
                <path
                  d="M32 8L52 16.5V33C52 46.2 43.2 55.6 32 59.5C20.8 55.6 12 46.2 12 33V16.5L32 8Z"
                  fill="url(#shieldInner)"
                />
                {/* Spartan / Esports Crest Helmet Silhouette */}
                <path
                  d="M32 14C25.5 14 21 18.8 21 25.5V33L26.5 36.5L28.5 30.5H35.5L37.5 36.5L43 33V25.5C43 18.8 38.5 14 32 14Z"
                  fill="#E2E8F0"
                />
                {/* Glowing Cyan Visor Eyes */}
                <path d="M24.5 25.5L30 27.5L29 29.5L24 27.5Z" fill="#00D2FF" />
                <path d="M39.5 25.5L34 27.5L35 29.5L40 27.5Z" fill="#00D2FF" />
                {/* Ribbon Banner */}
                <rect
                  x="9"
                  y="37"
                  width="46"
                  height="13"
                  rx="2.5"
                  fill="#091326"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                />
                <text
                  x="32"
                  y="42.5"
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="4.3"
                  fontWeight="800"
                  letterSpacing="0.08em"
                >
                  ELITE
                </text>
                <text
                  x="32"
                  y="48"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="5.4"
                  fontWeight="900"
                  letterSpacing="0.06em"
                >
                  GAMERS
                </text>
                <text
                  x="32"
                  y="56"
                  textAnchor="middle"
                  fill="#FACC15"
                  fontSize="4.2"
                  fontWeight="800"
                  letterSpacing="0.12em"
                >
                  ARENA
                </text>
                <defs>
                  <linearGradient id="shieldBorder" x1="7" y1="3" x2="57" y2="65" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8" />
                    <stop offset="0.5" stopColor="#E2E8F0" />
                    <stop offset="1" stopColor="#FACC15" />
                  </linearGradient>
                  <linearGradient id="shieldInner" x1="32" y1="8" x2="32" y2="59.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0284C7" stopOpacity="0.45" />
                    <stop offset="1" stopColor="#0F172A" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Interactive Login / Register Mode Switcher Pill */}
            <div
              className={`inline-flex rounded-lg p-1 text-[11px] font-semibold border ${
                isDark
                  ? 'bg-slate-950/60 border-white/10 text-slate-400'
                  : 'bg-slate-200/80 border-slate-300/80 text-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => setTab('register')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  tab === 'register'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'hover:text-sky-400'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  tab === 'login'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'hover:text-sky-400'
                }`}
              >
                Log in
              </button>
            </div>
          </div>

          {/* Headings */}
          <div className="space-y-1.5">
            <h1
              className={`text-[22px] sm:text-[24px] font-bold tracking-tight leading-snug ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Welcome to EliteGamingArena
            </h1>
            <p
              className={`text-xs sm:text-[13px] font-normal ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Log in or Register with your email / phone
            </p>
          </div>

          {/* Fast Social / OAuth Buttons */}
          <div className="mt-6 space-y-3">
            {/* Primary OAuth Button: Electric Cyan (#00B4D8 / #00C8F8) */}
            <button
              type="button"
              className="group relative w-full flex items-center justify-center gap-2.5 rounded-lg bg-[#00C2FF] hover:bg-[#19C9FF] active:scale-[0.98] py-3 px-4 text-[13px] font-bold text-slate-950 shadow-lg shadow-sky-500/25 transition-all duration-200"
            >
              <Gamepad2 className="h-4 w-4 text-slate-950 transition-transform duration-200 group-hover:scale-110" />
              <span>Continue with Steam</span>
            </button>

            {/* Secondary OAuth Button: Frosted Glass with Google 'G' / Chrome Icon */}
            <button
              type="button"
              className={`group w-full flex items-center justify-center gap-2.5 rounded-lg py-3 px-4 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] border ${
                isDark
                  ? 'bg-[#253248]/80 hover:bg-[#2E3E58]/90 text-white border-white/10'
                  : 'bg-slate-800/90 hover:bg-slate-800 text-white border-slate-900/15 shadow-sm'
              }`}
            >
              {/* Authentic Multi-Color Google 'G' Vector + Lucide Chrome support */}
              <span className="relative flex items-center justify-center">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                <Chrome className="sr-only" />
              </span>
              <span>Sign up with Google</span>
            </button>
          </div>

          {/* Clean Horizontal Divider with Centered "OR" */}
          <div className="my-5 flex items-center gap-3">
            <div
              className={`h-px flex-1 ${
                isDark ? 'bg-slate-700/70' : 'bg-slate-300'
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              OR
            </span>
            <div
              className={`h-px flex-1 ${
                isDark ? 'bg-slate-700/70' : 'bg-slate-300'
              }`}
            />
          </div>

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email / Phone / Free Fire UID Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ega-email"
                  className={`block text-xs font-medium ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  Email<span className="text-amber-400">*</span>
                </label>
                <span
                  className={`text-[10px] ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Email / Phone / Free Fire UID
                </span>
              </div>

              <div className="relative">
                <input
                  id="ega-email"
                  type="text"
                  value={email}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email, phone, or Free Fire UID"
                  className={`w-full rounded-lg px-3.5 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 border-amber-400 focus:ring-2 focus:ring-amber-400/40 ${
                    isDark
                      ? 'bg-[#0B1526]/90 text-white placeholder-slate-500 border'
                      : 'bg-slate-900 text-white placeholder-slate-400 border-2'
                  } ${
                    emailFocused
                      ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                      : 'border-amber-400/80'
                  }`}
                />
                {/* Simulated High-Contrast Cyber-Gold Caret Indicator when not typing */}
                {emailFocused && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-amber-400 animate-ping"
                  />
                )}
              </div>
            </div>

            {/* Password Input with Show/Hide Eye Toggle */}
            <div className="space-y-1.5">
              <label
                htmlFor="ega-password"
                className={`block text-xs font-medium ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Password<span className="text-amber-400">*</span>
              </label>

              <div className="relative">
                <input
                  id="ega-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className={`w-full rounded-lg px-3.5 py-2.5 pr-10 text-[13px] outline-none transition-all duration-200 border ${
                    isDark
                      ? 'bg-[#111E34]/90 border-white/10 text-white placeholder-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40'
                      : 'bg-white/90 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Security Validation Checklist */}
            <div className="pt-0.5 space-y-2">
              {/* Rule 1: 8+ Characters */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-200 ${
                    validation.hasMinLength
                      ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/40'
                      : isDark
                      ? 'bg-slate-600/70 text-slate-900'
                      : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
                <span
                  className={`text-xs transition-colors duration-200 ${
                    validation.hasMinLength
                      ? isDark
                        ? 'text-emerald-300 font-medium'
                        : 'text-emerald-700 font-medium'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-600'
                  }`}
                >
                  Must be at least 8 characters
                </span>
              </div>

              {/* Rule 2: 1+ Special Character */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-200 ${
                    validation.hasSpecialChar
                      ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/40'
                      : isDark
                      ? 'bg-slate-600/70 text-slate-900'
                      : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
                <span
                  className={`text-xs transition-colors duration-200 ${
                    validation.hasSpecialChar
                      ? isDark
                        ? 'text-emerald-300 font-medium'
                        : 'text-emerald-700 font-medium'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-600'
                  }`}
                >
                  Must contain one special character
                </span>
              </div>
            </div>

            {/* Bottom Cyber Gold CTA Button with 0.96x Active Spring Bounce */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-3 px-4 text-[13px] font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all duration-150 ease-out cursor-pointer"
              >
                {isSubmitted
                  ? '✔ Welcome to the Arena!'
                  : tab === 'register'
                  ? 'Create an account'
                  : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}