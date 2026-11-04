import React from 'react';
import {
  ShieldCheck,
  KeyRound,
  LogOut,
  Trophy,
  Crosshair,
  Flame,
  Wallet,
  MessageSquare,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { Theme, UserProfile, AuthProvider } from '../types';
import { cx } from '../utils/formatters';

interface ProfileScreenProps {
  theme: Theme;
  user: UserProfile;
  provider: AuthProvider;
  setProvider: (provider: AuthProvider) => void;
  joinedCount: number;
  onOpenSettings: () => void;
  onSecurity: () => void;
  onSignOut: () => void;
}

export function ProfileScreen({
  theme,
  user,
  provider,
  setProvider,
  joinedCount,
  onOpenSettings,
  onSecurity,
  onSignOut,
}: ProfileScreenProps) {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-4">
      {/* Identity Profile Hero Section */}
      <section
        className={cx(
          'relative overflow-hidden rounded-2xl border p-4 transition-all',
          isDark
            ? 'border-white/10 bg-[#0B1526] text-white shadow-xl'
            : 'border-slate-200 bg-white text-slate-950 shadow-sm'
        )}
      >
        {/* Auth Provider Switcher (Phone primary, Google backup) */}
        <div
          className={cx(
            'relative z-10 mb-3 flex items-center justify-between border-b pb-3',
            isDark ? 'border-white/10' : 'border-slate-200'
          )}
        >
          <span
            className={cx(
              'text-[10px] font-black uppercase tracking-wider',
              isDark ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            Login Method
          </span>
          <div
            className={cx(
              'inline-flex rounded-lg border p-0.5 text-[10px] font-bold',
              isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-slate-100'
            )}
          >
            <button
              type="button"
              onClick={() => setProvider('phone')}
              className={cx(
                'rounded-md px-2.5 py-1 transition-all',
                provider === 'phone'
                  ? isDark
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-slate-950 text-white font-black'
                  : isDark
                  ? 'text-slate-400'
                  : 'text-slate-600'
              )}
            >
              Phone Login (Main)
            </button>
            <button
              type="button"
              onClick={() => setProvider('google')}
              className={cx(
                'rounded-md px-2.5 py-1 transition-all',
                provider === 'google'
                  ? isDark
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-slate-950 text-white font-black'
                  : isDark
                  ? 'text-slate-400'
                  : 'text-slate-600'
              )}
            >
              Google (Backup)
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className={cx(
              'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 font-black transition-all',
              isDark
                ? 'border-white/20 bg-slate-800 text-white'
                : 'border-slate-900 bg-slate-100 text-slate-950'
            )}
          >
            {provider === 'google' ? (
              <span className="text-xl font-black">G</span>
            ) : (
              <Phone className="h-6 w-6 text-slate-900" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className={cx('truncate text-base font-black', isDark ? 'text-white' : 'text-slate-950')}>
                {user?.name || 'Spartan Player'}
              </h2>
              <span
                className={cx(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-black',
                  isDark
                    ? 'border-white/10 bg-slate-800 text-slate-200'
                    : 'border-slate-200 bg-slate-100 text-slate-800'
                )}
              >
                Verified
              </span>
            </div>

            <p className={cx('mt-1 truncate text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-700')}>
              {provider === 'google'
                ? `Google: ${user?.identifier || 'erik.padamans@gmail.com'}`
                : `Mobile: ${user?.identifier || '+91 98765 43210'}`}
            </p>

            <div className={cx('mt-1 flex items-center gap-2 text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-500">
                <ShieldCheck className="h-3 w-3" /> Anti-Cheat Clear
              </span>
              <span>•</span>
              <span>Tier: Grandmaster IV</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSecurity}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FFD000] px-3 py-2 text-xs font-black text-slate-950 transition-all hover:bg-[#FFDA29] active:scale-[0.96] shadow-sm"
          >
            <KeyRound className="h-3.5 w-3.5" /> Account Security
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-[0.96]',
              isDark
                ? 'border-white/10 bg-slate-900 text-slate-300 hover:text-white'
                : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
            )}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </section>

      {/* Esports Career Stats Grid */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3
            className={cx(
              'text-xs font-black uppercase tracking-wider',
              isDark ? 'text-slate-200' : 'text-slate-900'
            )}
          >
            Esports Career Stats
          </h3>
          <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Free Fire Max • Official Scrims
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            ['Matches Played', '48', '100% Lobby Completion', Trophy],
            ['Total Kills', '142', '2.96 K/D Ratio', Crosshair],
            ['Booyah / Win Rate', '28%', '14 Total Wins', Flame],
            ['Total Earnings', '₹3,450', 'Instant UPI Credited', Wallet],
          ].map(([label, value, meta, Icon]) => (
            <div
              key={String(label)}
              className={cx(
                'rounded-2xl border p-3.5 transition-all',
                isDark
                  ? 'border-white/10 bg-[#0B1526]'
                  : 'border-slate-200 bg-white shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    'text-[10px] font-bold uppercase tracking-wider',
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  {String(label)}
                </span>
                <div
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-lg border',
                    isDark ? 'border-white/10 bg-slate-900 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className={cx(
                  'mt-1.5 text-xl font-black tracking-tight',
                  isDark ? 'text-white' : 'text-slate-950'
                )}
              >
                {String(value)}
              </p>
              <p
                className={cx(
                  'mt-0.5 text-[10px] font-medium',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                {String(meta)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* WhatsApp Fair Play Support Card */}
      <section
        className={cx(
          'flex items-center justify-between gap-2 rounded-2xl border p-3.5 transition-all',
          isDark
            ? 'border-white/10 bg-[#0B1526]'
            : 'border-slate-200 bg-white shadow-sm'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              isDark ? 'border-white/10 bg-slate-900 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className={cx('truncate text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
              Fair Play & WhatsApp Helpdesk
            </p>
            <p className={cx('truncate text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {joinedCount} matches joined • organiser support online
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className={cx(
            'inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all active:scale-95',
            isDark
              ? 'border-white/15 bg-slate-800 text-white hover:bg-slate-700'
              : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
          )}
        >
          Open <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </section>
    </div>
  );
}
