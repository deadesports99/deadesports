import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Swords,
  Wallet,
  Zap,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Ambient } from '../../components/common/Ambient';
import { Crest } from '../../components/common/Crest';
import { RoleBadge } from '../../components/common/RoleBadge';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useToast } from '../../components/common/Toast';

type Mode = 'owner' | 'staff';
type Phase = 'credentials' | 'otp';

const OTP_LENGTH = 6;
const KEY_LENGTH = 24;

/**
 * Admin sign-in — the exact flow the backend implements:
 *
 *   Owner : email ─────────────────────► OTP on the owner inbox
 *   Staff : owner email + 24-char key ─► OTP on the owner inbox
 *
 * The key decides *which* staff identity the session gets; permissions are read
 * live from the User row (never from the key). Errors stay generic so the form
 * cannot be used to discover valid emails.
 */
export function AdminLoginScreen() {
  const isDark = useTheme() === 'dark';
  const toast = useToast();
  const { signIn } = useSession();

  const [mode, setMode] = useState<Mode>('owner');
  const [phase, setPhase] = useState<Phase>('credentials');
  const [email, setEmail] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendLeft, setResendLeft] = useState(60);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [attemptsHint, setAttemptsHint] = useState('');

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (phase !== 'otp' || resendLeft <= 0) return undefined;
    const timer = window.setInterval(() => setResendLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phase, resendLeft]);

  const resetToCredentials = () => {
    setPhase('credentials');
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    setAttemptsHint('');
    setDebugOtp(null);
  };

  const requestOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError('');
    setAttemptsHint('');

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address');
      return;
    }
    if (mode === 'staff' && accessKey.trim().length < 10) {
      setError(`Enter the ${KEY_LENGTH}-character permission key from the owner`);
      return;
    }

    setBusy(true);
    try {
      const result = await api.auth.requestOtp({
        email: cleanEmail,
        accessKey: mode === 'staff' ? accessKey.trim() : undefined,
      });
      setDebugOtp(result.debugOtp ?? null);
      setResendLeft(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      setPhase('otp');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 80);
      toast.success('Sign-in code sent');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not send the code';
      // Owner tab + a staff email: the server asks for the key — switch tab.
      if (/permission key/i.test(message)) {
        setMode('staff');
        setError('This email is a staff account — enter the owner email and your permission key.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const updateDigit = (index: number, value: string) => {
    setError('');
    setAttemptsHint('');
    const digits = value.replace(/\D/g, '');
    const next = [...otp];

    if (digits.length > 1) {
      digits
        .slice(0, OTP_LENGTH)
        .split('')
        .forEach((digit, offset) => {
          if (index + offset < OTP_LENGTH) next[index + offset] = digit;
        });
      setOtp(next);
      otpRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    next[index] = digits;
    setOtp(next);
    if (digits && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    event.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((digit, index) => {
      next[index] = digit;
    });
    setOtp(next);
    otpRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Enter all 6 digits');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.auth.verifyOtp({
        email: email.trim(),
        otp: code,
        accessKey: mode === 'staff' ? accessKey.trim() : undefined,
      });
      const me = await signIn();
      if (!me) throw new ApiError('Session could not be established', 401);
      toast.success(`Welcome back${me.name ? `, ${me.name}` : ''}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Verification failed';
      setError(message);
      if (/too many/i.test(message)) setAttemptsHint('This code is locked — request a fresh one.');
      setOtp(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const fillDebugOtp = () => {
    if (!debugOtp) return;
    setOtp(debugOtp.slice(0, OTP_LENGTH).split(''));
    setError('');
    otpRefs.current[OTP_LENGTH - 1]?.focus();
  };

  return (
    <div
      className={cx(
        'relative flex min-h-screen w-full flex-col overflow-x-hidden',
        isDark ? 'bg-[#050B14] text-white' : 'bg-slate-100 text-slate-950'
      )}
    >
      <Ambient />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1.05fr_minmax(400px,440px)] lg:items-center lg:gap-12 lg:py-10">
        {/* ── Hero (desktop only) ─────────────────────────────────────── */}
        <section className="hidden lg:block">
          <div className="flex items-center gap-3">
            <Crest />
            <div>
              <p className="font-spartan text-2xl font-black tracking-tight">Spartan Arena</p>
              <p className={cx('text-[11px] font-bold uppercase tracking-[0.24em]', isDark ? 'text-amber-300' : 'text-amber-600')}>
                Operations Console
              </p>
            </div>
          </div>

          <h1 className="mt-8 max-w-lg font-display text-[34px] font-black leading-[1.1] tracking-tight">
            Match night ka poora control,{" "}
            <span className={isDark ? 'text-amber-300' : 'text-amber-600'}>ek browser tab</span> me.
          </h1>
          <p className={cx('mt-3 max-w-md text-sm leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
            Matches, room IDs, live scoring, wallet approvals aur staff permissions — sab kuch
            wahi data, same design language jo player app me hai.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: Swords, title: 'Create → publish → score', text: 'Room reveal windows and IST scheduling built in.' },
              { icon: Wallet, title: 'Money with a paper trail', text: 'Deposits, withdrawal UTRs and settlement reports.' },
              { icon: ShieldCheck, title: 'Staff access keys', text: 'Owner-inbox OTP + revocable 24-character keys.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  className={cx(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                    isDark
                      ? 'border-white/10 bg-white/[0.04] text-amber-300'
                      : 'border-slate-200 bg-white text-amber-600'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-black">{title}</p>
                  <p className={cx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className={cx(
              'mt-8 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold',
              isDark ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            Private console — no public links, no search indexing.
          </div>
        </section>

        {/* ── Auth card ──────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[440px] lg:mx-0">
          {/* Mobile brand + theme */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <Crest small />
              <div>
                <p className="text-sm font-black leading-none tracking-tight">Spartan Arena</p>
                <p className={cx('mt-1 text-[9px] font-bold uppercase tracking-[0.2em]', isDark ? 'text-amber-300' : 'text-amber-600')}>
                  Admin Console
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div
            className={cx(
              'w-full overflow-hidden rounded-[26px] border transition-all',
              isDark
                ? 'border-white/[0.08] bg-[#0C121E] shadow-2xl shadow-black/90'
                : 'border-slate-200/90 bg-white shadow-xl shadow-slate-900/[0.05]'
            )}
          >
            <div className="p-5 sm:p-7">
              {phase === 'credentials' ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black tracking-tight sm:text-2xl">Admin sign in</h2>
                      <p className={cx('mt-1 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {mode === 'owner'
                          ? 'Owner email par 6-digit code aayega.'
                          : 'Owner email + permission key se staff login.'}
                      </p>
                    </div>
                    <div className="hidden lg:block">
                      <ThemeToggle />
                    </div>
                  </div>

                  {/* Mode switch */}
                  <div
                    className={cx(
                      'mt-5 grid grid-cols-2 gap-1 rounded-xl border p-1',
                      isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-slate-100'
                    )}
                    role="tablist"
                    aria-label="Login type"
                  >
                    {(
                      [
                        { id: 'owner' as Mode, label: 'Owner', hint: 'Full access' },
                        { id: 'staff' as Mode, label: 'Staff', hint: 'Key required' },
                      ]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={mode === tab.id}
                        onClick={() => {
                          if (busy) return;
                          setMode(tab.id);
                          setError('');
                        }}
                        className={cx(
                          'rounded-lg px-2 py-2 text-[11px] font-black transition-all',
                          mode === tab.id
                            ? isDark
                              ? 'bg-white/[0.09] text-white shadow-sm'
                              : 'bg-white text-slate-950 shadow-sm'
                            : isDark
                              ? 'text-slate-400 hover:text-slate-200'
                              : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        {tab.label}
                        <span className={cx('ml-1 hidden font-medium sm:inline', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          · {tab.hint}
                        </span>
                      </button>
                    ))}
                  </div>

                  <form onSubmit={requestOtp} className="mt-4 space-y-3.5">
                    {/* Email */}
                    <div>
                      <label
                        htmlFor="admin-email"
                        className={cx('mb-1.5 flex items-center gap-1.5 text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}
                      >
                        <Mail className={cx('h-3.5 w-3.5', isDark ? 'text-slate-400' : 'text-slate-500')} />
                        {mode === 'owner' ? 'Owner email' : 'Owner email (admin)'}
                      </label>
                      <input
                        id="admin-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError('');
                        }}
                        placeholder="deadesports99@gmail.com"
                        className={cx(
                          'h-12 w-full rounded-xl border px-3.5 text-[14px] font-bold outline-none transition-all',
                          isDark
                            ? 'border-white/15 bg-[#060B14] text-white placeholder:font-medium placeholder:text-slate-600 focus:border-white focus:ring-2 focus:ring-white/20'
                            : 'border-slate-300 bg-slate-50 text-slate-950 placeholder:font-medium placeholder:text-slate-400 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/15'
                        )}
                        autoFocus
                      />
                    </div>

                    {/* Staff key */}
                    {mode === 'staff' && (
                      <div className="animate-fade-up">
                        <label
                          htmlFor="admin-key"
                          className={cx('mb-1.5 flex items-center gap-1.5 text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}
                        >
                          <KeyRound className={cx('h-3.5 w-3.5', isDark ? 'text-slate-400' : 'text-slate-500')} />
                          Permission key
                          <span className={cx('font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
                            (24 characters)
                          </span>
                        </label>
                        <div
                          className={cx(
                            'flex h-12 items-center overflow-hidden rounded-xl border transition-all',
                            isDark
                              ? 'border-white/15 bg-[#060B14] focus-within:border-white focus-within:ring-2 focus-within:ring-white/20'
                              : 'border-slate-300 bg-slate-50 focus-within:border-black focus-within:bg-white focus-within:ring-2 focus-within:ring-black/15'
                          )}
                        >
                          <input
                            id="admin-key"
                            type={showKey ? 'text' : 'password'}
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            maxLength={KEY_LENGTH}
                            value={accessKey}
                            onChange={(event) => {
                              setAccessKey(event.target.value.replace(/\s+/g, ''));
                              setError('');
                            }}
                            placeholder="Xk9mQ2pL7vR4tY8nB3cW6dAz"
                            className={cx(
                              'h-full w-full bg-transparent px-3.5 font-mono text-[13px] font-bold tracking-wide outline-none',
                              isDark ? 'text-white placeholder:text-slate-600' : 'text-slate-950 placeholder:text-slate-400'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey((value) => !value)}
                            aria-label={showKey ? 'Hide permission key' : 'Show permission key'}
                            className={cx('flex h-9 w-9 shrink-0 items-center justify-center', isDark ? 'text-slate-400' : 'text-slate-500')}
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className={cx('mt-1.5 text-[10px] leading-relaxed', isDark ? 'text-slate-500' : 'text-slate-500')}>
                          Key owner deta hai. OTP phir bhi owner ke email par jaata hai.
                        </p>
                      </div>
                    )}

                    {error && (
                      <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-rose-400">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFD000] px-4 text-[13px] font-black text-slate-950 shadow-md shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.98] disabled:opacity-70"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {busy ? 'Sending code…' : 'Send sign-in code'}
                    </button>
                  </form>

                  <div
                    className={cx(
                      'mt-5 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10px] leading-relaxed',
                      isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
                    )}
                  >
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Email OTP + httpOnly session cookie. Staff keys can be revoked instantly by the
                      owner — a revoked key kills the session on the next request.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={resetToCredentials}
                    disabled={busy}
                    className={cx(
                      'group inline-flex items-center gap-2 text-xs font-bold transition-all',
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950'
                    )}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    Back to sign in
                  </button>

                  <div className="mt-4">
                    <h2 className="text-xl font-black tracking-tight sm:text-2xl">Enter OTP</h2>
                    <p className={cx('mt-1 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      6-digit code owner ke email par bheja gaya hai.
                    </p>
                  </div>

                  {/* Email + mode summary */}
                  <div
                    className={cx(
                      'mt-4 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5',
                      isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-slate-50'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Mail className={cx('h-3.5 w-3.5 shrink-0', isDark ? 'text-slate-400' : 'text-slate-500')} />
                      <div className="min-w-0">
                        <p className={cx('truncate text-[12px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
                          {email.trim()}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <RoleBadge
                            user={
                              mode === 'owner'
                                ? ({ role: 'ADMIN' } as never)
                                : ({ role: 'SUB_ADMIN' } as never)
                            }
                          />
                          <span className={cx('text-[9px]', isDark ? 'text-slate-500' : 'text-slate-500')}>
                            {mode === 'staff' ? 'key verified on submit' : 'owner inbox'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetToCredentials}
                      disabled={busy}
                      className={cx(
                        'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95',
                        isDark
                          ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'
                          : 'border-slate-300 bg-white text-slate-800'
                      )}
                    >
                      Change
                    </button>
                  </div>

                  <form onSubmit={verifyOtp} className="mt-4 space-y-3.5">
                    <div onPaste={onPaste}>
                      <label
                        htmlFor="otp-0"
                        className={cx('mb-2 flex items-center justify-between text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}
                      >
                        <span>6-digit code</span>
                        <span className={cx('text-[10px] font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          10 min expiry
                        </span>
                      </label>

                      <div className="flex justify-between gap-1.5 sm:gap-2">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            id={`otp-${index}`}
                            ref={(element) => {
                              otpRefs.current[index] = element;
                            }}
                            value={digit}
                            maxLength={OTP_LENGTH}
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            aria-label={`Digit ${index + 1} of 6`}
                            onChange={(event) => updateDigit(index, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Backspace' && !otp[index] && index > 0) {
                                const next = [...otp];
                                next[index - 1] = '';
                                setOtp(next);
                                otpRefs.current[index - 1]?.focus();
                              }
                              if (event.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
                              if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
                            }}
                            className={cx(
                              'h-12 w-full min-w-0 rounded-xl border text-center text-lg font-black outline-none transition-all sm:h-14 sm:text-xl',
                              digit
                                ? isDark
                                  ? 'border-white bg-[#101826] text-white ring-1 ring-white/40'
                                  : 'border-black bg-white text-black ring-1 ring-black/20'
                                : isDark
                                  ? 'border-white/15 bg-[#060B14] text-white focus:border-white focus:ring-1 focus:ring-white/30'
                                  : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-black focus:bg-white focus:ring-1 focus:ring-black/20'
                            )}
                          />
                        ))}
                      </div>

                      {error && (
                        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] font-semibold text-rose-400">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {error}
                            {attemptsHint && <span className="block">{attemptsHint}</span>}
                          </span>
                        </p>
                      )}
                    </div>

                    {debugOtp && (
                      <div
                        className={cx(
                          'flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2',
                          isDark ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-amber-300 bg-amber-50'
                        )}
                      >
                        <span className={cx('text-[10px] font-bold', isDark ? 'text-amber-300' : 'text-amber-700')}>
                          DEV — backend log code:{' '}
                          <code className="font-mono text-[12px]">{debugOtp}</code>
                        </span>
                        <button
                          type="button"
                          onClick={fillDebugOtp}
                          className={cx(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black',
                            isDark ? 'border-amber-400/30 text-amber-200' : 'border-amber-300 text-amber-700'
                          )}
                        >
                          <Zap className="h-3 w-3" /> Fill
                        </button>
                      </div>
                    )}

                    <div
                      className={cx(
                        'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs',
                        isDark ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Clock3 className={cx('h-3.5 w-3.5', isDark ? 'text-slate-400' : 'text-slate-500')} />
                        {resendLeft > 0 ? (
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                            Resend in{' '}
                            <strong className={cx('font-mono font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                              00:{String(resendLeft).padStart(2, '0')}
                            </strong>
                          </span>
                        ) : (
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Didn&apos;t receive the code?</span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={busy || resendLeft > 0}
                        onClick={() => void requestOtp()}
                        className={cx(
                          'inline-flex items-center gap-1.5 text-[11px] font-black underline transition-opacity disabled:opacity-40',
                          isDark ? 'text-white' : 'text-slate-950'
                        )}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Resend
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFD000] px-4 text-[13px] font-black text-slate-950 shadow-md shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.98] disabled:opacity-70"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {busy ? 'Verifying…' : 'Verify & continue'}
                    </button>
                  </form>

                  <div
                    className={cx(
                      'mt-4 flex items-center justify-center gap-1.5 border-t pt-3 text-[10px]',
                      isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-500'
                    )}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Staff? Owner se code lo, phir permission key ke saath verify karo.
                  </div>
                </>
              )}
            </div>
          </div>

          <p className={cx('mt-4 text-center text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>
            Spartan Arena · Admin access only · All actions are audited
          </p>
        </section>
      </div>
    </div>
  );
}
