import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ShieldCheck, Pencil, Check, X, AlertTriangle, Clock3, RefreshCw, Headphones } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';
import { Crest } from '../../components/common/Crest';
import { Ambient } from '../../components/common/Ambient';
import { GlassCard } from '../../components/common/GlassCard';

interface OtpScreenProps {
  theme: Theme;
  onThemeToggle: () => void;
  identifier: string;
  setIdentifier: (value: string) => void;
  onBack: () => void;
  onVerified: () => void;
}

export function OtpScreen({
  theme,
  onThemeToggle,
  identifier,
  setIdentifier,
  onBack,
  onVerified,
}: OtpScreenProps) {
  const isDark = theme === 'dark';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [editing, setEditing] = useState(false);
  const [tempIdentifier, setTempIdentifier] = useState(identifier);
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

  const verify = (event: React.FormEvent) => {
    event.preventDefault();
    if (otp.join('').length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      onVerified();
    }, 650);
  };

  const saveIdentifier = () => {
    if (tempIdentifier.trim().length < 4) return;
    setIdentifier(tempIdentifier.trim());
    setOtp(['', '', '', '', '', '']);
    setTimeLeft(60);
    setEditing(false);
    refs.current[0]?.focus();
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6">
      <Ambient theme={theme} />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <GlassCard theme={theme} className="w-full overflow-hidden rounded-3xl">
          <div
            className={cx(
              'absolute inset-x-0 top-0 h-40',
              isDark
                ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(255,208,0,0.15),transparent_70%)]'
                : 'bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.05),transparent_70%)]'
            )}
          />
          <div className="relative z-10 p-6 sm:p-8">
            <button
              type="button"
              onClick={onBack}
              className={cx(
                'group inline-flex items-center gap-2 text-xs font-bold transition-all',
                isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-950'
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
              Back to Login
            </button>

            <div className="mt-7 flex items-start justify-between gap-3">
              <div>
                <Crest />
                <p
                  className={cx(
                    'mt-4 text-[10px] font-bold uppercase tracking-[0.22em]',
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  Step 2 of 2 • Verification
                </p>
              </div>
              <span
                className={cx(
                  'mt-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold',
                  isDark
                    ? 'border-white/10 bg-slate-900/60 text-slate-300'
                    : 'border-slate-200 bg-slate-100 text-slate-700'
                )}
              >
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> Protected
              </span>
            </div>

            <h1
              className={cx(
                'mt-5 text-2xl font-black tracking-tight',
                isDark ? 'text-white' : 'text-slate-950'
              )}
            >
              Verification Code
            </h1>
            <p className={cx('mt-1 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
              Enter the 6-digit code sent to your registered mobile number.
            </p>

            {/* Phone badge with edit option */}
            <div className="mt-4">
              {editing ? (
                <div
                  className={cx(
                    'flex items-center gap-2 rounded-xl border p-1.5',
                    isDark
                      ? 'border-white/20 bg-[#0B1526]'
                      : 'border-slate-400 bg-white'
                  )}
                >
                  <input
                    autoFocus
                    value={tempIdentifier}
                    onChange={(event) => setTempIdentifier(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveIdentifier();
                      if (event.key === 'Escape') setEditing(false);
                    }}
                    className={cx(
                      'min-w-0 flex-1 bg-transparent px-2 text-[13px] font-bold outline-none',
                      isDark ? 'text-white' : 'text-slate-950'
                    )}
                  />
                  <button
                    type="button"
                    onClick={saveIdentifier}
                    className="rounded-lg bg-[#FFD000] px-2.5 py-1.5 text-[11px] font-black text-slate-950"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className={cx('rounded-lg p-1.5', isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5',
                    isDark ? 'border-white/10 bg-[#0B1526]/85' : 'border-slate-200 bg-slate-100'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className={cx('truncate text-[13px] font-black tracking-wide', isDark ? 'text-white' : 'text-slate-950')}>
                      {identifier || '+91 98765 43210'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempIdentifier(identifier);
                      setEditing(true);
                    }}
                    className={cx(
                      'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all',
                      isDark
                        ? 'border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                    )}
                  >
                    <Pencil className="h-3 w-3" /> Change
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={verify} className="mt-6 space-y-5">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="otp-0"
                    className={cx('text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}
                  >
                    6-Digit Security Code
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
                      isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-950'
                    )}
                  >
                    Auto-fill demo code
                  </button>
                </div>

                <div className="flex justify-between gap-1.5 sm:gap-2.5">
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
                        'h-14 w-11 rounded-xl border text-center text-xl font-black outline-none transition-all sm:w-12',
                        digit
                          ? isDark
                            ? 'border-white/30 bg-[#111E34] text-white'
                            : 'border-slate-900 bg-slate-50 text-slate-950 ring-1 ring-slate-900'
                          : isDark
                          ? 'border-white/10 bg-[#0B1526]/90 text-white'
                          : 'border-slate-300 bg-white text-slate-900',
                        'focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15'
                      )}
                    />
                  ))}
                </div>

                {error && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {error}
                  </p>
                )}
              </div>

              {/* Timer / Resend */}
              <div
                className={cx(
                  'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs',
                  isDark ? 'border-white/5 bg-[#0B1526]/60' : 'border-slate-200 bg-slate-100/75'
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

              {/* Verify Button */}
              <button
                type="submit"
                disabled={verifying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD000] px-4 py-3 text-[13px] font-black text-slate-950 shadow-lg shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.97] disabled:opacity-70"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  'Verify OTP & Continue'
                )}
              </button>
            </form>

            <div
              className={cx(
                'mt-5 flex items-center justify-center gap-1.5 border-t pt-4 text-[10px]',
                isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
              )}
            >
              <Headphones className="h-3.5 w-3.5 text-slate-400" /> Spartan Tournament Support is online
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
