import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface SecurityModalProps {
  theme: Theme;
  onClose: () => void;
  onSave: () => void;
}

export function SecurityModal({
  theme,
  onClose,
  onSave,
}: SecurityModalProps) {
  const isDark = theme === 'dark';
  const [pin, setPin] = useState('4829');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cx(
          'w-full max-w-sm rounded-2xl border p-4 shadow-2xl transition-all',
          isDark
            ? 'border-white/15 bg-slate-900 text-white'
            : 'border-slate-300 bg-white text-slate-950'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-wider">Account Security & PIN</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cx(
              'rounded-lg p-1 transition-colors',
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="security-pin"
              className={cx(
                'mb-1 block text-[10px] font-black uppercase tracking-wider',
                isDark ? 'text-slate-400' : 'text-slate-600'
              )}
            >
              Withdrawal Security PIN
            </label>
            <input
              id="security-pin"
              type="password"
              maxLength={4}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, '').slice(0, 4))
              }
              className={cx(
                'w-full rounded-xl border px-3 py-2 text-center text-lg font-mono font-black tracking-[0.5em] outline-none transition-all',
                isDark
                  ? 'border-white/20 bg-[#081120] text-white focus:border-white'
                  : 'border-slate-300 bg-slate-50 text-slate-950 focus:border-slate-900'
              )}
            />
          </div>
          <p className={cx('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Use a private 4-digit PIN to protect UPI withdrawals and instant transfers.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pin.length !== 4}
              onClick={onSave}
              className="rounded-lg bg-[#FFD000] px-3 py-1.5 text-xs font-black text-slate-950 transition-all hover:bg-[#FFDA29] active:scale-95 disabled:opacity-50"
            >
              Save Security PIN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
