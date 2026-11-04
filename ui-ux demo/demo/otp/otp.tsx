import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  Sun,
  Moon,
  Pencil,
  Check,
  X,
  RefreshCw,
  MessageSquare,
  Headphones,
  Sparkles,
  CheckCircle2,
  Clock,
} from '../icons/tg-icons';

interface EliteGamingArenaOTPProps {
  initialEmail?: string;
  initialTheme?: 'dark' | 'light';
  onBackToLogin?: () => void;
  onVerifySuccess?: (otpCode: string, email: string) => void;
}

export default function EliteGamingArenaOTP({
  initialEmail = 'erik.padamans@gmail.co',
  initialTheme = 'dark',
  onBackToLogin,
  onVerifySuccess,
}: EliteGamingArenaOTPProps) {
  // Theme & Step State
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);
  const isDark = theme === 'dark';

  // Email & Inline Edit State
  const [email, setEmail] = useState<string>(initialEmail);
  const [tempEmail, setTempEmail] = useState<string>(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(false);

  // 6-Digit OTP State & Refs
  const [otp, setOtp] = useState<string[]>(['4', '8', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(2);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & Resend State (Starts at 48s to match spec preview, resets to 60s on resend)
  const [timeLeft, setTimeLeft] = useState<number>(48);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);

  // Submission / Verification State
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'sms'>('email');

  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // Focus active OTP box on initial mount
  useEffect(() => {
    inputRefs.current[2]?.focus();
  }, []);

  // Focus inline email editor when opened
  useEffect(() => {
    if (isEditingEmail) {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    }
  }, [isEditingEmail]);

  // 60-Second Countdown Loop
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format seconds as MM:SS (e.g., 00:48)
  const formattedTime = `00:${timeLeft.toString().padStart(2, '0')}`;

  // Handle Single Digit Change & Auto-Advance
  const handleDigitChange = (index: number, rawValue: string) => {
    setErrorMessage(null);
    if (status === 'error') setStatus('idle');

    // Handle multi-character input if mobile autocomplete injects full code
    if (rawValue.length > 1) {
      const digits = rawValue.replace(/\D/g, '').slice(0, 6).split('');
      if (digits.length > 0) {
        const updated = [...otp];
        digits.forEach((d, idx) => {
          if (index + idx < 6) updated[index + idx] = d;
        });
        setOtp(updated);
        const nextFocus = Math.min(index + digits.length, 5);
        inputRefs.current[nextFocus]?.focus();
      }
      return;
    }

    const digit = rawValue.replace(/\D/g, '');
    const updatedOtp = [...otp];
    updatedOtp[index] = digit;
    setOtp(updatedOtp);

    // Auto-advance to next input when a digit is typed
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace & Arrow Key Navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setErrorMessage(null);
      const updatedOtp = [...otp];

      if (updatedOtp[index]) {
        // Clear current box first
        updatedOtp[index] = '';
        setOtp(updatedOtp);
      } else if (index > 0) {
        // Move back and clear previous box
        updatedOtp[index - 1] = '';
        setOtp(updatedOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle 6-Digit Clipboard Paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const updatedOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      updatedOtp[i] = pastedData[i];
    }
    setOtp(updatedOtp);
    setErrorMessage(null);

    const targetFocus = Math.min(pastedData.length, 5);
    inputRefs.current[targetFocus]?.focus();
  };

  // Save Updated Email Address Inline
  const handleSaveEmail = () => {
    const trimmed = tempEmail.trim();
    if (!trimmed || trimmed.length < 4) return;
    setEmail(trimmed);
    setIsEditingEmail(false);
    setOtp(['', '', '', '', '', '']);
    setTimeLeft(60);
    setResendFeedback('New OTP sent to updated email');
    setTimeout(() => setResendFeedback(null), 3000);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  // Trigger Resend OTP & Reset Timer to 60s
  const handleResendOTP = () => {
    if (timeLeft > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsResending(false);
      setTimeLeft(60);
      setOtp(['', '', '', '', '', '']);
      setResendFeedback(
        deliveryChannel === 'sms'
          ? 'Fresh 6-digit code sent via SMS / WhatsApp!'
          : 'Fresh 6-digit code sent to your email!'
      );
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendFeedback(null), 3500);
    }, 450);
  };

  // Switch to SMS / WhatsApp Channel
  const handleSwitchChannel = () => {
    const nextChannel = deliveryChannel === 'email' ? 'sms' : 'email';
    setDeliveryChannel(nextChannel);
    setTimeLeft(60);
    setOtp(['', '', '', '', '', '']);
    setResendFeedback(
      nextChannel === 'sms'
        ? 'OTP dispatched via SMS / WhatsApp'
        : 'OTP dispatched to your registered email'
    );
    inputRefs.current[0]?.focus();
    setTimeout(() => setResendFeedback(null), 3500);
  };

  // Submit & Verify OTP
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join('');

    if (fullCode.length < 6) {
      setStatus('error');
      setErrorMessage('Please enter all 6 digits of your verification code.');
      const firstEmptyIndex = otp.findIndex((digit) => digit === '');
      if (firstEmptyIndex !== -1) {
        inputRefs.current[firstEmptyIndex]?.focus();
      }
      return;
    }

    setStatus('verifying');
    setErrorMessage(null);

    setTimeout(() => {
      setStatus('verified');
      onVerifySuccess?.(fullCode, email);
      setTimeout(() => {
        setStatus('idle');
      }, 2400);
    }, 1100);
  };

  const isComplete = otp.every((digit) => digit !== '');

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

      {/* Main 1:1 OTP Card with Strict Dual-Theme Glassmorphism */}
      <main
        className={`relative w-full max-w-[430px] rounded-[26px] overflow-hidden transition-all duration-500 ${
          isDark
            ? 'bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/70'
            : 'bg-white/75 backdrop-blur-md border border-slate-900/10 shadow-xl shadow-slate-900/15'
        }`}
      >
        {/* Atmospheric Gamer Artwork & Starfield Header Backdrop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[330px] overflow-hidden">
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${
              isDark
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(14,165,233,0.28),_rgba(15,23,42,0.88)_62%,_rgba(15,23,42,1)_100%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.32),_rgba(241,245,249,0.75)_65%,_rgba(255,255,255,0.95)_100%)]'
            }`}
          />

          {/* Starfield & Gamer Silhouette SVG */}
          <svg
            viewBox="0 0 430 330"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <g opacity={isDark ? '0.85' : '0.45'}>
              <circle cx="195" cy="36" r="1.3" fill="#7DD3FC" />
              <circle cx="240" cy="24" r="1.8" fill="#E0F2FE" />
              <circle cx="275" cy="58" r="1.2" fill="#38BDF8" />
              <circle cx="218" cy="78" r="1.5" fill="#BAE6FD" />
              <circle cx="160" cy="64" r="1.1" fill="#7DD3FC" />
              <circle cx="310" cy="30" r="1.6" fill="#FDE68A" />
              <circle cx="145" cy="110" r="1.2" fill="#38BDF8" />
              <circle cx="255" cy="108" r="1.4" fill="#E0F2FE" />
              <path
                d="M170 15L290 95"
                stroke="url(#otpCyanGlow)"
                strokeWidth="0.75"
                strokeDasharray="3 5"
              />
              <path
                d="M235 8L370 100"
                stroke="url(#otpCyanGlow)"
                strokeWidth="0.75"
                strokeDasharray="2 4"
              />
            </g>

            {/* Right-Side Esports Gamer Silhouette with Glowing Cyan Headset */}
            <g opacity={isDark ? '0.68' : '0.28'}>
              <circle cx="370" cy="145" r="78" fill="url(#otpGamerAura)" />
              <path
                d="M318 112C322 74 356 54 392 60C418 64 435 88 435 126C435 162 420 202 406 232L305 232C312 204 328 188 338 168C326 154 316 134 318 112Z"
                fill={isDark ? '#0B192E' : '#334155'}
              />
              <path
                d="M332 118C332 142 344 162 362 168C378 172 396 158 400 132C404 106 388 84 364 84C344 84 332 98 332 118Z"
                fill={isDark ? '#162A47' : '#475569'}
              />
              <path
                d="M342 74C364 56 402 64 412 96"
                stroke="#38BDF8"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle
                cx="392"
                cy="126"
                r="16"
                fill={isDark ? '#091930' : '#1E293B'}
                stroke="#00D2FF"
                strokeWidth="4.5"
              />
              <circle cx="392" cy="126" r="7" fill="#38BDF8" fillOpacity="0.6" />
              <path
                d="M378 136C364 148 346 152 332 148"
                stroke="#00D2FF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>

            <defs>
              <linearGradient
                id="otpCyanGlow"
                x1="170"
                y1="15"
                x2="370"
                y2="100"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#38BDF8" stopOpacity="0" />
                <stop offset="0.5" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
              <radialGradient
                id="otpGamerAura"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(370 145) scale(78)"
              >
                <stop stopColor="#00D2FF" stopOpacity="0.45" />
                <stop offset="1" stopColor="#00D2FF" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Bottom Fade into Card Body */}
          <div
            className={`absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t ${
              isDark
                ? 'from-[#0D182B] via-[#0D182B]/80 to-transparent'
                : 'from-white/90 via-white/60 to-transparent'
            }`}
          />
        </div>

        {/* Inner Content Container */}
        <div className="relative z-10 px-7 pt-7 pb-8 sm:px-8">
          {/* 2. Top Bar: Back to Login + Free Fire Tournament Badge */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToLogin}
              className={`group inline-flex items-center gap-2 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-300/90 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back to Login</span>
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

          {/* Hexagonal Esports Shield Crest + Step Indicator */}
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
                <path
                  d="M32 3L57 13.5V33.5C57 49.5 46.2 60.8 32 65C17.8 60.8 7 49.5 7 33.5V13.5L32 3Z"
                  fill="#0B192E"
                  stroke="url(#otpShieldBorder)"
                  strokeWidth="2.5"
                />
                <path
                  d="M32 8L52 16.5V33C52 46.2 43.2 55.6 32 59.5C20.8 55.6 12 46.2 12 33V16.5L32 8Z"
                  fill="url(#otpShieldInner)"
                />
                <path
                  d="M32 14C25.5 14 21 18.8 21 25.5V33L26.5 36.5L28.5 30.5H35.5L37.5 36.5L43 33V25.5C43 18.8 38.5 14 32 14Z"
                  fill="#E2E8F0"
                />
                <path d="M24.5 25.5L30 27.5L29 29.5L24 27.5Z" fill="#00D2FF" />
                <path d="M39.5 25.5L34 27.5L35 29.5L40 27.5Z" fill="#00D2FF" />
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
                  <linearGradient
                    id="otpShieldBorder"
                    x1="7"
                    y1="3"
                    x2="57"
                    y2="65"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#38BDF8" />
                    <stop offset="0.5" stopColor="#E2E8F0" />
                    <stop offset="1" stopColor="#FACC15" />
                  </linearGradient>
                  <linearGradient
                    id="otpShieldInner"
                    x1="32"
                    y1="8"
                    x2="32"
                    y2="59.5"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#0284C7" stopOpacity="0.45" />
                    <stop offset="1" stopColor="#0F172A" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Security Step Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border ${
                isDark
                  ? 'bg-slate-950/60 border-white/10 text-sky-400'
                  : 'bg-sky-50 border-sky-200 text-sky-700'
              }`}
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Step 2 of 2 • 2FA</span>
            </div>
          </div>

          {/* 3. Headlines & Editable Email Identifier Box */}
          <div className="space-y-1.5">
            <h1
              className={`text-[22px] sm:text-[24px] font-bold tracking-tight leading-snug ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Verification Code
            </h1>
            <p
              className={`text-xs sm:text-[13px] font-normal leading-relaxed ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              We have sent a 6-digit confirmation code to your registered{' '}
              {deliveryChannel === 'sms' ? 'phone / WhatsApp' : 'email'}
            </p>
          </div>

          {/* Sleek Identifier Pill / Inline Editor */}
          <div className="mt-4">
            {!isEditingEmail ? (
              <div
                className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 border transition-all ${
                  isDark
                    ? 'bg-[#0B1526]/85 border-white/10 text-slate-200'
                    : 'bg-slate-100/90 border-slate-300/80 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                  <span className="truncate text-[13px] font-semibold tracking-tight">
                    {email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTempEmail(email);
                    setIsEditingEmail(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                    isDark
                      ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-amber-400/25'
                      : 'bg-white hover:bg-slate-50 text-amber-600 border border-amber-500/30 shadow-2xs'
                  }`}
                >
                  <Pencil className="h-3 w-3" />
                  <span>Change</span>
                </button>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 rounded-xl p-1.5 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.2)] ${
                  isDark ? 'bg-[#0B1526]' : 'bg-slate-900'
                }`}
              >
                <input
                  ref={emailInputRef}
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEmail();
                    if (e.key === 'Escape') setIsEditingEmail(false);
                  }}
                  placeholder="Enter correct email address"
                  className="flex-1 bg-transparent px-2.5 py-1 text-[13px] font-medium text-white placeholder-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveEmail}
                  aria-label="Save email"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 transition-colors cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(false)}
                  aria-label="Cancel email edit"
                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Form & 6-Digit OTP Input Grid */}
          <form onSubmit={handleVerifySubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label
                  htmlFor="otp-input-0"
                  className={`text-xs font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Enter 6-digit security code<span className="text-amber-400">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setOtp(['4', '8', '2', '9', '1', '6']);
                    setErrorMessage(null);
                    inputRefs.current[5]?.focus();
                  }}
                  className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'text-sky-400 hover:text-sky-300'
                      : 'text-sky-600 hover:text-sky-700'
                  }`}
                >
                  Auto-fill demo code
                </button>
              </div>

              {/* 4. 6-Digit Squircle Grid */}
              <div className="flex items-center justify-between gap-2 sm:gap-2.5">
                {otp.map((digit, index) => {
                  const isFocused = focusedIndex === index;
                  const isFilled = digit !== '';

                  return (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={digit}
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      aria-label={`Digit ${index + 1} of 6`}
                      className={`w-11 h-14 sm:w-12 sm:h-14 rounded-xl text-center font-extrabold text-xl tracking-tight outline-none transition-all duration-200 ${
                        isFocused
                          ? isDark
                            ? 'bg-[#0B1526] text-white border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-[1.03]'
                            : 'bg-slate-900 text-white border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-[1.03]'
                          : isFilled
                          ? isDark
                            ? 'bg-[#111E34]/95 text-amber-300 border border-amber-400/50 shadow-inner'
                            : 'bg-white text-slate-900 border-2 border-amber-500/60 shadow-xs'
                          : isDark
                          ? 'bg-[#0B1526]/90 text-white border border-white/10 hover:border-white/20'
                          : 'bg-white/90 text-slate-900 border border-slate-300 hover:border-slate-400'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Validation or Resend Feedback Message */}
              {errorMessage && (
                <p className="mt-2.5 text-xs font-medium text-rose-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                  {errorMessage}
                </p>
              )}

              {resendFeedback && !errorMessage && (
                <p
                  className={`mt-2.5 text-xs font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {resendFeedback}
                </p>
              )}
            </div>

            {/* 5. Dynamic 60-Second Countdown Timer & Resend Code Bar */}
            <div
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs border ${
                isDark
                  ? 'bg-[#0B1526]/60 border-white/5'
                  : 'bg-slate-100/75 border-slate-200/90'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock
                  className={`h-3.5 w-3.5 ${
                    timeLeft > 0
                      ? 'text-amber-400 animate-pulse'
                      : isDark
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                />
                {timeLeft > 0 ? (
                  <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                    Resend code in{' '}
                    <strong
                      className={`font-mono font-bold ${
                        isDark ? 'text-amber-400' : 'text-amber-600'
                      }`}
                    >
                      {formattedTime}
                    </strong>
                  </span>
                ) : (
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                    Didn&apos;t receive the code yet?
                  </span>
                )}
              </div>

              {timeLeft > 0 ? (
                <button
                  type="button"
                  onClick={() => setTimeLeft(0)}
                  title="Skip timer for testing"
                  className={`text-[11px] font-medium underline-offset-2 hover:underline cursor-pointer ${
                    isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Skip wait
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isResending}
                  className={`inline-flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                    isDark
                      ? 'text-[#00C2FF] hover:text-sky-300'
                      : 'text-sky-600 hover:text-sky-700'
                  }`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`}
                  />
                  <span>{isResending ? 'Sending...' : 'Resend OTP'}</span>
                </button>
              )}
            </div>

            {/* 6. Primary Action CTA: Full-Width Vibrant Cyber Gold */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={status === 'verifying'}
                className={`w-full rounded-lg bg-[#FFD000] hover:bg-[#FFDA29] active:scale-[0.96] py-3 px-4 text-[13px] font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-2 ${
                  !isComplete && status === 'idle' ? 'opacity-95' : ''
                }`}
              >
                {status === 'verifying' ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                    <span>✔ Verifying code...</span>
                  </>
                ) : status === 'verified' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-slate-950 stroke-[2.5]" />
                    <span>✔ Verified! Entering Arena...</span>
                  </>
                ) : (
                  <span>Verify OTP &amp; Continue</span>
                )}
              </button>
            </div>
          </form>

          {/* 7. Footer Helper Links: SMS / WhatsApp & Tournament Support */}
          <div
            className={`mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px] ${
              isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}
          >
            <button
              type="button"
              onClick={handleSwitchChannel}
              className={`inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                isDark ? 'hover:text-white' : 'hover:text-slate-950'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#00C2FF]" />
              <span>
                Didn&apos;t receive code?{' '}
                <strong className={isDark ? 'text-sky-400' : 'text-sky-600'}>
                  {deliveryChannel === 'email' ? 'Try via SMS / WhatsApp' : 'Try via Email'}
                </strong>
              </span>
            </button>

            <a
              href="#support"
              onClick={(e) => {
                e.preventDefault();
                setResendFeedback('Tournament Support Live Chat opened');
                setTimeout(() => setResendFeedback(null), 3000);
              }}
              className={`inline-flex items-center gap-1 font-medium transition-colors ${
                isDark ? 'hover:text-amber-300' : 'hover:text-amber-700'
              }`}
            >
              <Headphones className="h-3.5 w-3.5 text-amber-400" />
              <span>Tournament Support</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}