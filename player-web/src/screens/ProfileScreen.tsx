import React, { useEffect, useState } from 'react';
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
import { cx, formatINR } from '../utils/formatters';

export interface PlayerCareerStats {
  matchesJoined: number;
  matchesPlayed: number;
  booyahs: number;
  totalKills: number;
  totalWinnings: number;
  bestRank: number | null;
}

interface ProfileScreenProps {
  theme: Theme;
  user: UserProfile;
  provider: AuthProvider;
  setProvider?: (provider: AuthProvider) => void;
  joinedCount: number;
  onOpenSettings: () => void;
  onSecurity: () => void;
  onSignOut: () => void;
  /** Real data from GET /players/me */
  playerCode?: string | null;
  stats?: PlayerCareerStats | null;
  inGameName?: string;
  inGameUid?: string;
  /** PATCH /players/me/game-profile — the organiser seats players by IGN/UID. */
  onSaveGameProfile?: (ign: string, uid: string) => Promise<void>;
}

export function ProfileScreen({
  theme,
  user,
  provider,
  joinedCount,
  onOpenSettings,
  onSecurity,
  onSignOut,
  playerCode,
  stats,
  inGameName = '',
  inGameUid = '',
  onSaveGameProfile,
}: ProfileScreenProps) {
  const isDark = theme === 'dark';

  const [ign, setIgn] = useState(inGameName);
  const [uid, setUid] = useState(inGameUid);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIgn(inGameName);
    setUid(inGameUid);
  }, [inGameName, inGameUid]);

  const ignOk = ign.trim().length >= 2 && ign.trim().length <= 30;
  const uidOk = /^\d{6,12}$/.test(uid.trim());
  const dirty = ign.trim() !== inGameName || uid.trim() !== inGameUid;

  const saveIdentity = async () => {
    if (!onSaveGameProfile) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await onSaveGameProfile(ign.trim(), uid.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Matches', value: String(stats?.matchesJoined ?? joinedCount) },
    { label: 'Booyahs', value: String(stats?.booyahs ?? 0) },
    { label: 'Kills', value: String(stats?.totalKills ?? 0) },
    { label: 'Winnings', value: formatINR(stats?.totalWinnings ?? 0) },
  ];

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
              {playerCode ? `Player ID: ${playerCode}` : 'Player ID: —'}
            </p>
          </div>
        </div>

        {/* Career numbers — real MatchResult + slot data */}
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={cx(
                'rounded-xl border px-1.5 py-2 text-center',
                isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-slate-50'
              )}
            >
              <p className={cx('text-[13px] font-black leading-none', isDark ? 'text-white' : 'text-slate-950')}>
                {card.value}
              </p>
              <p className={cx('mt-1 text-[8px] font-bold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {card.label}
              </p>
            </div>
          ))}
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

      {/* Free Fire Identity — this is what the organiser uses to seat you */}
      <section
        className={cx(
          'rounded-2xl border p-4',
          isDark ? 'border-white/10 bg-[#0C121E]' : 'border-slate-200 bg-white shadow-sm'
        )}
      >
        <div className="flex items-center justify-between">
          <p className={cx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-slate-300' : 'text-slate-600')}>
            Your Free Fire Details
          </p>
          {saved && <span className="text-[10px] font-black text-emerald-500">Saved ✓</span>}
        </div>

        <label className="mt-3 block">
          <span className={cx('mb-1 block text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-600')}>
            In-Game Name (IGN)
          </span>
          <input
            value={ign}
            onChange={(event) => setIgn(event.target.value.slice(0, 30))}
            placeholder="e.g. SpartanOP"
            className={cx(
              'h-11 w-full rounded-xl border px-3 text-[13px] font-bold outline-none transition-all',
              isDark
                ? 'border-white/15 bg-[#060B14] text-white placeholder:text-slate-600 focus:border-white'
                : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-black'
            )}
          />
        </label>

        <label className="mt-2 block">
          <span className={cx('mb-1 block text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-600')}>
            Free Fire UID
          </span>
          <input
            value={uid}
            inputMode="numeric"
            onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="6-12 digit UID"
            className={cx(
              'h-11 w-full rounded-xl border px-3 text-[13px] font-bold tracking-widest outline-none transition-all',
              isDark
                ? 'border-white/15 bg-[#060B14] text-white placeholder:text-slate-600 focus:border-white'
                : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-black'
            )}
          />
        </label>

        {saveError && <p className="mt-2 text-[11px] font-semibold text-rose-500">{saveError}</p>}

        <button
          type="button"
          disabled={!ignOk || !uidOk || saving || !dirty}
          onClick={() => void saveIdentity()}
          className={cx(
            'mt-3 h-11 w-full rounded-xl text-xs font-black transition-all active:scale-[0.97]',
            ignOk && uidOk && dirty && !saving
              ? 'bg-[#FFD000] text-slate-950 hover:bg-[#FFDA29]'
              : isDark
              ? 'bg-white/10 text-slate-400'
              : 'bg-slate-200 text-slate-500'
          )}
        >
          {saving ? 'Saving...' : dirty ? 'Save Free Fire details' : 'Saved to your profile'}
        </button>
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
              {joinedCount} {joinedCount === 1 ? 'match' : 'matches'} joined • 24/7 Organiser Support
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
