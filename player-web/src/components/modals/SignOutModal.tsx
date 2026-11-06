import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface SignOutModalProps {
  theme: Theme;
  onClose: () => void;
  onConfirm: () => void;
}

export function SignOutModal({
  theme,
  onClose,
  onConfirm,
}: SignOutModalProps) {
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cx(
          'w-full max-w-sm rounded-2xl border p-4 shadow-2xl transition-all',
          isDark ? 'border-white/15 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-950'
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/15 text-rose-500">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider">Confirm Sign Out</h3>
            <p className={cx('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-600')}>
              Return to the Spartan Arena login screen?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            )}
          >
            Stay Logged In
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-rose-500/25 transition-all hover:bg-rose-600 active:scale-95"
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
