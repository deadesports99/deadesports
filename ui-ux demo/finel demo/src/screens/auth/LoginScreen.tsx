import React from 'react';
import { Phone, Shield, ArrowRight } from 'lucide-react';
import { Theme, AuthProvider } from '../../types';
import { cx } from '../../utils/formatters';
import { Crest } from '../../components/common/Crest';
import { Ambient } from '../../components/common/Ambient';
import { GlassCard } from '../../components/common/GlassCard';

interface LoginScreenProps {
  theme: Theme;
  onThemeToggle?: () => void;
  identifier: string;
  setIdentifier: (value: string) => void;
  onContinue: (provider?: AuthProvider) => void;
}

export function LoginScreen({
  theme,
  identifier,
  setIdentifier,
  onContinue,
}: LoginScreenProps) {
  const isDark = theme === 'dark';

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onContinue('phone');
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
            {/* Header / Brand & Title */}
            <div>
              <div className="flex items-center gap-3.5">
                <Crest />
                <div>
                  <span
                    className={cx(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase',
                      isDark
                        ? 'border-amber-400/25 bg-amber-400/10 text-amber-400'
                        : 'border-amber-500/30 bg-amber-50 text-amber-800'
                    )}
                  >
                    ⚡ Free Fire Arena
                  </span>
                  <p
                    className={cx(
                      'mt-1 text-[11px] font-bold tracking-wider uppercase',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )}
                  >
                    Spartan Esports Platform
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <h1
                  className={cx(
                    'text-2xl font-black tracking-tight sm:text-[26px]',
                    isDark ? 'text-white' : 'text-slate-950'
                  )}
                >
                  Enter the Arena
                </h1>
                <p
                  className={cx(
                    'mt-1 text-xs font-medium leading-relaxed',
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  )}
                >
                  Enter your 10-digit mobile number for instant OTP verification.
                </p>
              </div>
            </div>

            {/* Primary Phone Login Form */}
            <form onSubmit={handlePhoneSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="phone-input"
                  className={cx(
                    'mb-1.5 flex items-center justify-between text-xs font-bold',
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#00C2FF]" />
                    <span>Mobile Number</span>
                  </span>
                  <span className={cx('text-[10px] font-semibold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    India (+91)
                  </span>
                </label>
                <div
                  className={cx(
                    'relative flex h-12 w-full items-center overflow-hidden rounded-xl border transition-all focus-within:ring-2 focus-within:ring-[#FFD000]/40',
                    isDark
                      ? 'border-white/15 bg-[#081120] text-white focus-within:border-[#FFD000]'
                      : 'border-slate-300 bg-slate-50/80 text-slate-950 focus-within:border-slate-900 focus-within:bg-white'
                  )}
                >
                  {/* Country Code Prefix */}
                  <div
                    className={cx(
                      'flex h-full select-none items-center gap-1.5 border-r px-3.5 text-xs font-black tracking-wider shrink-0 transition-colors',
                      isDark
                        ? 'border-white/10 bg-slate-900/80 text-slate-200'
                        : 'border-slate-200 bg-slate-100 text-slate-800'
                    )}
                  >
                    <svg className="h-3.5 w-5 rounded-[2px] shadow-sm" viewBox="0 0 640 480">
                      <path fill="#f93" d="M0 0h640v160H0z" />
                      <path fill="#fff" d="M0 160h640v160H0z" />
                      <path fill="#128807" d="M0 320h640v160H0z" />
                      <circle cx="320" cy="240" r="32" fill="#008" />
                      <circle cx="320" cy="240" r="28" fill="#fff" />
                      <circle cx="320" cy="240" r="8" fill="#008" />
                    </svg>
                    <span>+91</span>
                  </div>

                  {/* Digits Input */}
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={identifier.replace(/^\+91\s*/, '')}
                    onChange={(event) => {
                      const clean = event.target.value.replace(/\D/g, '').slice(0, 10);
                      setIdentifier(clean ? `+91 ${clean}` : '');
                    }}
                    placeholder="98765 43210"
                    className={cx(
                      'h-full w-full bg-transparent px-3.5 text-[15px] font-bold tracking-widest outline-none transition-colors',
                      isDark
                        ? 'text-white placeholder:text-slate-600'
                        : 'text-slate-950 placeholder:text-slate-400'
                    )}
                    autoFocus
                  />
                </div>
                <p
                  className={cx(
                    'mt-1.5 text-[10px]',
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  Room ID aur tournament updates isi number par aayenge.
                </p>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD000] px-4 py-3 text-[13px] font-black text-slate-950 shadow-lg shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.97]"
              >
                <span>Continue with Phone</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Subtle Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className={cx('h-px flex-1', isDark ? 'bg-white/10' : 'bg-slate-200')} />
              <span
                className={cx(
                  'text-[10px] font-bold uppercase tracking-widest',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Backup option
              </span>
              <div className={cx('h-px flex-1', isDark ? 'bg-white/10' : 'bg-slate-200')} />
            </div>

            {/* Google Backup Button */}
            <button
              type="button"
              onClick={() => onContinue('google')}
              className={cx(
                'flex w-full items-center justify-center gap-2.5 rounded-xl border py-2.5 text-[13px] font-bold transition-all active:scale-[0.97]',
                isDark
                  ? 'border-white/15 bg-slate-900/80 text-white hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50'
              )}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google (Demo Backup)</span>
            </button>

            {/* Footer trust badge */}
            <div
              className={cx(
                'mt-6 flex items-center justify-center gap-1.5 text-[10px]',
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              <Shield className="h-3 w-3 text-emerald-500" />
              <span>Safe & Secure • OTP verification in next step</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
