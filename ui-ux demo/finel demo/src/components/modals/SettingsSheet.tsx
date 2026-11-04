import React from 'react';
import { Settings, X, Moon, Sun, ShieldCheck, MessageSquare, ChevronRight } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface SettingsSheetProps {
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onClose: () => void;
  onWhatsApp: () => void;
}

export function SettingsSheet({
  theme,
  onTheme,
  onClose,
  onWhatsApp,
}: SettingsSheetProps) {
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={cx(
          'max-h-[86%] overflow-y-auto rounded-t-[28px] border-t p-4 shadow-2xl max-w-lg mx-auto w-full transition-all',
          isDark
            ? 'border-white/15 bg-slate-900/95 text-white'
            : 'border-slate-300 bg-white/95 text-slate-950'
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-400/40" />

        {/* Title */}
        <div
          className={cx(
            'flex items-center justify-between border-b pb-3',
            isDark ? 'border-white/10' : 'border-slate-200'
          )}
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-black">Arena Settings & Fair Play</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={cx(
              'rounded-lg p-1.5 transition-all active:scale-95',
              isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:text-slate-950'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3.5 space-y-3">
          {/* Theme selector */}
          <div
            className={cx(
              'flex items-center justify-between rounded-xl border p-3.5',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2.5">
              {isDark ? (
                <Moon className="h-4 w-4 text-slate-300" />
              ) : (
                <Sun className="h-4 w-4 text-slate-700" />
              )}
              <div>
                <p className="text-xs font-black">Theme Appearance</p>
                <p className={cx('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {isDark ? 'Dark Mode (Spartan Onyx)' : 'Light Mode (Clean Frost)'}
                </p>
              </div>
            </div>
            <div
              className={cx(
                'inline-flex rounded-lg border p-0.5 text-[10px] font-bold',
                isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'
              )}
            >
              <button
                type="button"
                onClick={() => onTheme('dark')}
                className={cx(
                  'rounded-md px-3 py-1 transition-all',
                  isDark
                    ? 'bg-white text-slate-950 font-black'
                    : 'text-slate-600 hover:text-slate-950'
                )}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => onTheme('light')}
                className={cx(
                  'rounded-md px-3 py-1 transition-all',
                  !isDark
                    ? 'bg-slate-950 text-white font-black'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Light
              </button>
            </div>
          </div>

          {/* Fair play guidelines */}
          <div
            className={cx(
              'rounded-xl border p-3.5',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs font-black">Fair Play Anti-Cheat Guidelines</p>
                <ul
                  className={cx(
                    'mt-2 space-y-1 text-[11px]',
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  )}
                >
                  <li>• Emulators and modded APKs are strictly banned.</li>
                  <li>• Gun props and third-party scripts must stay OFF.</li>
                  <li>• Room ID and password unlock 15 minutes before match start.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* WhatsApp Support CTA */}
          <button
            type="button"
            onClick={onWhatsApp}
            className={cx(
              'flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] shadow-sm',
              isDark
                ? 'border-white/10 bg-slate-800/90 text-white hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black">Contact Organiser on WhatsApp</p>
                <p className={cx('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Direct priority support for match entry and UPI payouts
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
