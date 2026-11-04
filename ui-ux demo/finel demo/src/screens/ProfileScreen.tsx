import React from 'react';
import {
  KeyRound,
  LogOut,
  MessageSquare,
  ChevronRight,
  Phone,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Theme, UserProfile, AuthProvider } from '../types';
import { cx } from '../utils/formatters';

interface ProfileScreenProps {
  theme: Theme;
  user: UserProfile;
  provider: AuthProvider;
  setProvider?: (provider: AuthProvider) => void;
  joinedCount: number;
  onOpenSettings: () => void;
  onSecurity: () => void;
  onSignOut: () => void;
}

export function ProfileScreen({
  theme,
  user,
  provider,
  joinedCount,
  onOpenSettings,
  onSecurity,
  onSignOut,
}: ProfileScreenProps) {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-4">
      {/* Identity Profile Card */}
      <section
        className={cx(
          'relative overflow-hidden rounded-2xl border p-5 transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] text-white shadow-xl shadow-black/40'
            : 'border-slate-200/90 bg-white text-slate-950 shadow-sm'
        )}
      >
        {/* User Info Lockup */}
        <div className="flex items-center gap-3.5">
          {/* Avatar Icon */}
          <div
            className={cx(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-black transition-all select-none',
              isDark
                ? 'border-white/15 bg-[#141C2E] text-white shadow-inner'
                : 'border-slate-200 bg-slate-100 text-slate-900'
            )}
          >
            {provider === 'google' ? (
              <span className="font-black text-xl">G</span>
            ) : (
              <Phone className={cx('h-6 w-6', isDark ? 'text-slate-200' : 'text-slate-800')} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className={cx('truncate text-base font-black', isDark ? 'text-white' : 'text-slate-950')}>
                {user?.name || 'Spartan Player'}
              </h2>
              <span
                className={cx(
                  'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                  isDark
                    ? 'border-white/15 bg-white/[0.04] text-slate-300'
                    : 'border-slate-300 bg-slate-100 text-slate-700'
                )}
              >
                Verified
              </span>
            </div>

            <p className={cx('mt-1 text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-600')}>
              {user?.identifier || '+91 98765 43210'}
            </p>

            <p className={cx('mt-0.5 text-[10px] font-medium tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Player UID: 84920194
            </p>
          </div>
        </div>

        {/* Action Buttons: Account Security & Sign Out */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onSecurity}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FFD000] px-3 py-2.5 text-xs font-black text-slate-950 shadow-sm transition-all hover:bg-[#FFDA29] active:scale-[0.97]"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Account Security</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all active:scale-[0.97]',
              isDark
                ? 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:text-white'
                : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </section>

      {/* WhatsApp Helpdesk & Support Card */}
      <section
        className={cx(
          'flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] shadow-sm'
            : 'border-slate-200 bg-white shadow-sm'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              isDark
                ? 'border-white/10 bg-[#141C2E] text-slate-300'
                : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className={cx('truncate text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
              Tournament Support & Helpdesk
            </p>
            <p className={cx('truncate text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {joinedCount} matches joined • 24/7 Organiser Support
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className={cx(
            'inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95',
            isDark
              ? 'border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]'
              : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
          )}
        >
          <span>Open</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </section>

      {/* Fair Play & Rules Notice */}
      <section
        className={cx(
          'flex items-center gap-3 rounded-2xl border p-4 transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] text-slate-400'
            : 'border-slate-200 bg-white text-slate-600 shadow-sm'
        )}
      >
        <Shield className="h-5 w-5 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className={cx('text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
            Fair Play & Official Tournament Rules
          </p>
          <p className="text-[10px] leading-relaxed mt-0.5">
            Third-party scripts, hacks, or emulator modifications are strictly prohibited.
          </p>
        </div>
      </section>
    </div>
  );
}
