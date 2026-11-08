import { useState } from 'react';
import {
  User,
  Moon,
  Sun,
  Bell,
  ShieldCheck,
  MessageSquare,
  LogOut,
  ChevronRight,
  X,
  Shield,
  Image as ImageIcon,
} from 'lucide-react';
import { Theme, UserProfile, AuthProvider } from '../types';
import { cx } from '../utils/formatters';
import { BG_OPTIONS, setBackground, useBackground } from '../lib/background';

interface SettingsScreenProps {
  theme: Theme;
  onThemeToggle: (nextTheme: Theme) => void;
  user: UserProfile;
  provider: AuthProvider;
  setProvider?: (provider: AuthProvider) => void;
  joinedCount: number;
  onSecurity?: () => void;
  onSignOut: () => void;
  onWhatsApp: () => void;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export function SettingsScreen({
  theme,
  onThemeToggle,
  user,
  provider,
  joinedCount,
  onSignOut,
  onWhatsApp,
  showToast,
}: SettingsScreenProps) {
  const isDark = theme === 'dark';

  // Sub-modals inside Settings
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [fairPlayModalOpen, setFairPlayModalOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const bg = useBackground();
  const bgOption = BG_OPTIONS.find((o) => o.id === bg.id) ?? BG_OPTIONS[0];

  const playerName = user?.name || 'Spartan Player';
  const playerPhone = user?.identifier || '+91 98765 43210';

  const handleToggleNotifications = () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    showToast(nextState ? 'Match alerts enabled' : 'Match alerts muted');
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Top Left Title: Settings */}
      <div className="px-1 pt-0.5">
        <h1 className={cx('text-2xl font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
          Settings
        </h1>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: MAIN SETTINGS (Telegram-style Card with Icon Chips) */}
      {/* ============================================================== */}
      <div
        className={cx(
          'overflow-hidden rounded-2xl border transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] shadow-xl shadow-black/40'
            : 'border-slate-200/90 bg-white shadow-sm'
        )}
      >
        {/* 1. Account (Only Username & Phone Number - No UID, No Verified Badge) */}
        <button
          type="button"
          onClick={() => setAccountModalOpen(true)}
          className={cx(
            'group flex w-full items-center justify-between p-3.5 text-left transition-colors',
            isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {/* Telegram Blue Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow-md shadow-[#2AABEE]/25">
              <User className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Account
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {playerName} • {playerPhone}
              </p>
            </div>
          </div>

          <ChevronRight className={cx('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} />
        </button>

        <div className={cx('h-px w-full ml-[62px]', isDark ? 'bg-white/5' : 'bg-slate-100')} />

        {/* 2. Appearance & Theme (Dark / Light Mode Toggle) */}
        <div
          className={cx(
            'flex items-center justify-between p-3.5 transition-colors',
            isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
            {/* Violet Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25">
              {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Appearance
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </p>
            </div>
          </div>

          {/* Inline Segmented Switch */}
          <div
            className={cx(
              'inline-flex shrink-0 rounded-xl border p-1 text-[11px] font-black',
              isDark ? 'border-white/10 bg-slate-950' : 'border-slate-300 bg-slate-100'
            )}
          >
            <button
              type="button"
              onClick={() => onThemeToggle('dark')}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
                isDark
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Moon className="h-3 w-3" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeToggle('light')}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
                !isDark
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Sun className="h-3 w-3" />
              <span>Light</span>
            </button>
          </div>
        </div>

        <div className={cx('h-px w-full ml-[62px]', isDark ? 'bg-white/5' : 'bg-slate-100')} />

        <div className={cx('h-px w-full ml-[62px]', isDark ? 'bg-white/5' : 'bg-slate-100')} />

        {/* 2b. Background image picker (demo) */}
        <div className="p-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0EA5E9] text-white shadow-md shadow-[#0EA5E9]/25">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-3">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Background
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {bgOption.label} &bull; {bg.opacity}% opacity
              </p>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {BG_OPTIONS.map((option) => {
              const active = option.id === bg.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBackground({ id: option.id })}
                  aria-pressed={active}
                  aria-label={`Background ${option.label}`}
                  className={cx(
                    'shrink-0 rounded-lg border p-1 transition-all active:scale-95',
                    active
                      ? 'border-amber-400 ring-2 ring-amber-400/40'
                      : isDark
                      ? 'border-white/10 hover:border-white/30'
                      : 'border-slate-200 hover:border-slate-400'
                  )}
                >
                  {option.src ? (
                    <img
                      src={option.src}
                      alt=""
                      className="h-12 w-8 rounded object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className={cx(
                        'flex h-12 w-8 items-center justify-center rounded text-[9px] font-black',
                        isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      OFF
                    </div>
                  )}
                  <span
                    className={cx(
                      'mt-1 block w-8 truncate text-center text-[9px] font-bold',
                      active ? 'text-amber-400' : isDark ? 'text-slate-400' : 'text-slate-500'
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Opacity slider */}
          <div className="mt-3 flex items-center gap-3">
            <span className={cx('text-[11px] font-bold', isDark ? 'text-slate-300' : 'text-slate-600')}>
              Opacity
            </span>
            <input
              type="range"
              min={10}
              max={50}
              step={2}
              value={bg.opacity}
              onChange={(e) => setBackground({ opacity: Number(e.target.value) })}
              aria-label="Background opacity"
              className="h-1 flex-1 accent-amber-400"
            />
            <span
              className={cx(
                'w-9 text-right text-[11px] font-black tabular-nums',
                isDark ? 'text-white' : 'text-slate-950'
              )}
            >
              {bg.opacity}%
            </span>
          </div>
        </div>

        {/* 3. Match Notifications */}
        <div
          className={cx(
            'flex items-center justify-between p-3.5 transition-colors',
            isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
            {/* Coral Red Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-md shadow-[#EF4444]/25">
              <Bell className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Notifications
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Match Alerts & Room ID
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={handleToggleNotifications}
            aria-label="Toggle notifications"
            className={cx(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              notificationsEnabled
                ? 'bg-emerald-500'
                : isDark
                ? 'bg-slate-700'
                : 'bg-slate-300'
            )}
          >
            <span
              className={cx(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: TOURNAMENT RULES & SUPPORT (Telegram-style Card) */}
      {/* ============================================================== */}
      <div
        className={cx(
          'overflow-hidden rounded-2xl border transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] shadow-xl shadow-black/40'
            : 'border-slate-200/90 bg-white shadow-sm'
        )}
      >
        {/* Fair Play & Anti-Cheat */}
        <button
          type="button"
          onClick={() => setFairPlayModalOpen(true)}
          className={cx(
            'group flex w-full items-center justify-between p-3.5 text-left transition-colors',
            isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {/* Amber Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-white shadow-md shadow-[#F59E0B]/25">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Fair Play Rules
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Anti-cheat & scrim guidelines
              </p>
            </div>
          </div>

          <ChevronRight className={cx('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} />
        </button>

        <div className={cx('h-px w-full ml-[62px]', isDark ? 'bg-white/5' : 'bg-slate-100')} />

        {/* WhatsApp & Helpdesk */}
        <button
          type="button"
          onClick={onWhatsApp}
          className={cx(
            'group flex w-full items-center justify-between p-3.5 text-left transition-colors',
            isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {/* WhatsApp Green Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-md shadow-[#22C55E]/25">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <span className={cx('text-sm font-bold', isDark ? 'text-white' : 'text-slate-950')}>
                Support
              </span>
              <p className={cx('truncate text-xs font-medium mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                24/7 WhatsApp helpdesk
              </p>
            </div>
          </div>

          <ChevronRight className={cx('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} />
        </button>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: LOGOUT (Sabse Niche - No Description As Requested) */}
      {/* ============================================================== */}
      <div
        className={cx(
          'overflow-hidden rounded-2xl border transition-all',
          isDark
            ? 'border-white/10 bg-[#0C121E] shadow-xl shadow-black/40'
            : 'border-slate-200/90 bg-white shadow-sm'
        )}
      >
        <button
          type="button"
          onClick={onSignOut}
          className={cx(
            'group flex w-full items-center justify-between p-3.5 text-left transition-colors',
            isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {/* Danger Red Icon Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-md shadow-[#EF4444]/25">
              <LogOut className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-sm font-bold text-rose-500">
                Log Out
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-rose-500/60 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* App Version Info Footnote */}
      <div className="pt-2 text-center">
        <p className={cx('text-[11px] font-semibold tracking-wide', isDark ? 'text-slate-500' : 'text-slate-400')}>
          Spartan Esports Arena • v2.4.0 (Build 104)
        </p>
      </div>

      {/* ============================================================== */}
      {/* READ-ONLY ACCOUNT INFO MODAL (NO FREE FIRE ID EDITING ALLOWED) */}
      {/* ============================================================== */}
      {accountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={cx(
              'w-full max-w-sm rounded-2xl border p-5 shadow-2xl transition-all',
              isDark ? 'border-white/15 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-950'
            )}
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Account Details</h3>
                  <p className={cx('text-[10px] font-semibold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Registered Player
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                aria-label="Close modal"
                className={cx(
                  'rounded-lg p-1.5 transition-colors',
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {/* Username */}
              <div
                className={cx(
                  'rounded-xl border p-3.5',
                  isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
                )}
              >
                <span className={cx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Username
                </span>
                <p className="text-sm font-black mt-0.5">{playerName}</p>
              </div>

              {/* Mobile Number */}
              <div
                className={cx(
                  'rounded-xl border p-3.5',
                  isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
                )}
              >
                <span className={cx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Mobile Number
                </span>
                <p className="text-sm font-black mt-0.5">{playerPhone}</p>
              </div>

              {/* Security notice */}
              <div
                className={cx(
                  'flex items-start gap-2.5 rounded-xl border p-3',
                  isDark ? 'border-white/10 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-100/60 text-slate-600'
                )}
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  For tournament anti-cheat and prize security, game accounts are permanently locked to this registered mobile number.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAccountModalOpen(false)}
              className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 shadow-md transition-all hover:bg-amber-300 active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FAIR PLAY & ANTI-CHEAT RULES MODAL                             */}
      {/* ============================================================== */}
      {fairPlayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={cx(
              'w-full max-w-sm rounded-2xl border p-5 shadow-2xl transition-all',
              isDark ? 'border-white/15 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-950'
            )}
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F59E0B] text-white shadow">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Fair Play Rules</h3>
                  <p className={cx('text-[10px] font-semibold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Official Scrim Guidelines
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFairPlayModalOpen(false)}
                aria-label="Close modal"
                className={cx(
                  'rounded-lg p-1.5 transition-colors',
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div
                className={cx(
                  'rounded-xl border p-3',
                  isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                )}
              >
                <p className="font-bold text-amber-400">1. Mobile Only Policy</p>
                <p className={cx('text-[11px] mt-0.5 leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  PC Emulators are strictly prohibited. Detected emulators will be auto-kicked.
                </p>
              </div>

              <div
                className={cx(
                  'rounded-xl border p-3',
                  isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                )}
              >
                <p className="font-bold text-rose-400">2. Anti-Cheat Policy</p>
                <p className={cx('text-[11px] mt-0.5 leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  Config files, headshot scripts, or modified APKs lead to permanent account ban.
                </p>
              </div>

              <div
                className={cx(
                  'rounded-xl border p-3',
                  isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                )}
              >
                <p className="font-bold text-emerald-400">3. Match Timing</p>
                <p className={cx('text-[11px] mt-0.5 leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  Room ID & Password unlock 15 minutes before the match start time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFairPlayModalOpen(false)}
              className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 shadow-md transition-all hover:bg-amber-300 active:scale-[0.98]"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
