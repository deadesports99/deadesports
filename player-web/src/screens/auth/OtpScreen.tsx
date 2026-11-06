import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Pencil, AlertTriangle, Clock3, RefreshCw, Headphones } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';
import { Ambient } from '../../components/common/Ambient';

interface OtpScreenProps {
  theme: Theme;
  onThemeToggle?: () => void;
  identifier: string;
  setIdentifier: (value: string) => void;
  onBack: () => void;
  /** Fires with the entered 6 digits; the parent talks to the backend. */
  onVerified: (code: string) => void;
  /** True while the backend is verifying the code. */
  busy?: boolean;
  /** Server-side error to show under the boxes. */
  errorText?: string;
}

export function OtpScreen({
  theme,
  identifier,
  onBack,
  onVerified,
  busy = false,
  errorText,
}: OtpScreenProps) {
  const isDark = theme === 'dark';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!timeLeft) return undefined;
    const timer = window.setInterval(
      () => setTimeLeft((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [timeLeft]);

  const updateDigit = (index: number, value: string) => {
    setError('');
    const digits = value.replace(/\D/g, '');
    const next = [...otp];
    if (digits.length > 1) {
      digits
        .slice(0, 6)
        .split('')
        .forEach((digit, offset) => {
          if (index + offset < 6) next[index + offset] = digit;
        });
      setOtp(next);
      refs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    next[index] = digits;
    setOtp(next);
    if (digits && index < 5) refs.current[index + 1]?.focus();
  };

  useEffect(() => {
    if (!busy) setVerifying(false);
  }, [busy]);

  const verify = (event: React.FormEvent) => {
    event.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }
    setError('');
    setVerifying(true);
    onVerified(code);
  };

  const shownError = errorText || error;

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6">
      <Ambient theme={theme} />
      <div className="relative z-10 mx-auto w-full max-w-[420px]">
        {/* Solid Architectural Card - Unified Palette */}
        <div
          className={cx(
            'w-full overflow-hidden rounded-[26px] border transition-all',
            isDark
              ? 'border-white/[0.08] bg-[#0C121E] shadow-2xl shadow-black/90'
              : 'border-slate-200/90 bg-white shadow-xl shadow-slate-900/[0.05]'
          )}
        >
          <div className="p-6 sm:p-7">
            {/* Back button */}
            <button
              type="button"
              onClick={onBack}
              className={cx(
                'group inline-flex items-center gap-2 text-xs font-bold transition-all',
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950'
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
              <span>Back to Login</span>
            </button>

            {/* Header info */}
            <div className="mt-5">
              <h1
                className={cx(
                  'text-2xl font-black tracking-tight',
                  isDark ? 'text-white' : 'text-slate-950'
                )}
              >
                Enter OTP
              </h1>
              <p className={cx('mt-1 text-xs font-medium leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Enter the 6-digit verification code sent to your mobile number.
              </p>
            </div>

            {/* Phone badge with Change button that navigates back to Login */}
            <div className="mt-4">
              <div
                className={cx(
                  'flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5',
                  isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-slate-50'
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Phone className={cx('h-3.5 w-3.5 shrink-0', isDark ? 'text-slate-400' : 'text-slate-500')} />
                  <span className={cx('truncate text-[13px] font-black tracking-wide', isDark ? 'text-white' : 'text-slate-950')}>
                    {identifier || '+91 98765 43210'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className={cx(
                    'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95',
                    isDark
                      ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      : 'border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                  )}
                >
                  <Pencil className="h-3 w-3" /> Change
                </button>
              </div>
            </div>

            {/* OTP Form */}
            <form onSubmit={verify} className="mt-5 space-y-4">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="otp-0"
                    className={cx('text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}
                  >
                    6-Digit Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp(['4', '8', '2', '9', '1', '6']);
                      setError('');
                      refs.current[5]?.focus();
                    }}
                    className={cx(
                      'text-[11px] font-bold underline transition-colors',
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
                    )}
                  >
                    Auto-fill demo
                  </button>
                </div>

                {/* OTP Boxes: White in dark mode, Black in light mode (No yellow!) */}
                <div className="flex justify-between gap-1.5 sm:gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      ref={(element) => {
                        refs.current[index] = element;
                      }}
                      value={digit}
                      maxLength={6}
                      inputMode="numeric"
                      aria-label={`Digit ${index + 1} of 6`}
                      onChange={(event) => updateDigit(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !otp[index] && index > 0) {
                          const next = [...otp];
                          next[index - 1] = '';
                          setOtp(next);
                          refs.current[index - 1]?.focus();
                        }
                        if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
                        if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
                      }}
                      className={cx(
                        'h-13 w-11 rounded-xl border text-center text-xl font-black outline-none transition-all sm:h-14 sm:w-12',
                        digit
                          ? isDark
                            ? 'border-white bg-[#101826] text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] ring-1 ring-white/40'
                            : 'border-black bg-white text-black shadow-sm ring-1 ring-black/20'
                          : isDark
                          ? 'border-white/15 bg-[#060B14] text-white focus:border-white focus:ring-1 focus:ring-white/30'
                          : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-black focus:bg-white focus:ring-1 focus:ring-black/20'
                      )}
                    />
                  ))}
                </div>

                {shownError && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {shownError}
                  </p>
                )}
              </div>

              {/* Timer / Resend Row */}
              <div
                className={cx(
                  'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs',
                  isDark ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock3 className={cx('h-3.5 w-3.5', timeLeft ? 'text-slate-400' : 'text-slate-500')} />
                  {timeLeft ? (
                    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      Resend in <strong className={cx('font-mono font-bold', isDark ? 'text-white' : 'text-slate-950')}>00:{String(timeLeft).padStart(2, '0')}</strong>
                    </span>
                  ) : (
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Didn&apos;t receive code?</span>
                  )}
                </div>

                {timeLeft ? (
                  <button
                    type="button"
                    onClick={() => setTimeLeft(0)}
                    className={cx('text-[11px] font-bold transition-colors', isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950')}
                  >
                    Skip wait
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTimeLeft(60);
                      setOtp(['', '', '', '', '', '']);
                      refs.current[0]?.focus();
                    }}
                    className={cx('inline-flex items-center gap-1.5 text-[11px] font-black underline', isDark ? 'text-white' : 'text-slate-950')}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Resend OTP
                  </button>
                )}
              </div>

              {/* Primary Action Button - Cyber Gold */}
              <button
                type="submit"
                disabled={verifying || busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD000] px-4 py-3 text-[13px] font-black text-slate-950 shadow-md shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.98] disabled:opacity-70"
              >
                {verifying || busy ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  'Verify OTP & Continue'
                )}
              </button>
            </form>

            {/* Footer Support Row - Monochrome */}
            <div
              className={cx(
                'mt-5 flex items-center justify-center gap-1.5 border-t pt-4 text-[10px]',
                isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
              )}
            >
              <Headphones className="h-3.5 w-3.5 text-slate-400" /> Spartan Tournament Support is online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
