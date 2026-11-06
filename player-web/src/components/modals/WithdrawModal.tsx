import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowUpRight,
  Smartphone,
  Building2,
  Clock3,
  ShieldCheck,
} from 'lucide-react';
import { Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';

interface WithdrawModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  /** True while the withdrawal request is in flight. */
  busy?: boolean;
  winningsCash: number;
  upiId: string;
  setUpiId: (val: string) => void;
  withdrawAmount: string;
  setWithdrawAmount: (val: string) => void;
  onWithdraw: () => void;
}

type WithdrawMethodType = 'upi' | 'bank';

export function WithdrawModal({
  theme,
  isOpen,
  onClose,
  busy = false,
  winningsCash,
  upiId,
  setUpiId,
  withdrawAmount,
  setWithdrawAmount,
  onWithdraw,
}: WithdrawModalProps) {
  const isDark = theme === 'dark';
  const [method, setMethod] = useState<WithdrawMethodType>('upi');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');

  if (!isOpen) return null;

  const handleWithdraw = () => {
    onWithdraw();
    onClose();
  };

  const amountNum = Number(withdrawAmount) || 0;
  const isEligible = amountNum >= 50 && amountNum <= winningsCash;

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-[70] flex flex-col justify-end backdrop-blur-sm transition-all animate-in fade-in duration-200',
        isDark ? 'bg-black/80' : 'bg-slate-900/40'
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'max-h-[90%] overflow-y-auto rounded-t-[28px] border-t p-4 pb-8 shadow-2xl max-w-lg mx-auto w-full transition-all',
          isDark
            ? 'border-white/15 bg-slate-900/98 text-white'
            : 'border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-900/15'
        )}
      >
        {/* Grab bar */}
        <div
          className={cx(
            'mx-auto mb-2.5 h-1.5 w-12 rounded-full',
            isDark ? 'bg-slate-500/40' : 'bg-slate-300'
          )}
        />

        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={cx(
                  'text-[10px] font-black uppercase tracking-widest',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Instant Payout
              </span>
              <span className={cx('text-[10px] font-bold', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                • Zero Deduction
              </span>
            </div>
            <h2 className={cx('mt-0.5 text-lg font-black', isDark ? 'text-white' : 'text-slate-950')}>
              Withdraw Winnings
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close withdraw modal"
            className={cx(
              'rounded-xl p-1.5 transition-all active:scale-95',
              isDark
                ? 'bg-slate-800 text-slate-300 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Available Winnings Box */}
        <div
          className={cx(
            'flex items-center justify-between rounded-xl border p-3',
            isDark
              ? 'border-white/10 bg-slate-950/70'
              : 'border-emerald-500/25 bg-emerald-50/70'
          )}
        >
          <div>
            <span
              className={cx(
                'text-[10px] font-bold uppercase tracking-wider',
                isDark ? 'text-slate-400' : 'text-emerald-800'
              )}
            >
              Available Winnings
            </span>
            <p className={cx('mt-0.5 text-lg font-black', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
              {formatINR(winningsCash)}
            </p>
          </div>
          <span
            className={cx(
              'rounded-full px-2.5 py-1 text-[10px] font-bold',
              isDark
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200/60'
            )}
          >
            100% Withdrawable
          </span>
        </div>

        {/* Method Toggle: UPI vs Bank Transfer */}
        <div className="mt-3.5 space-y-2">
          <label
            className={cx(
              'block text-[10px] font-bold uppercase tracking-wider',
              isDark ? 'text-slate-400' : 'text-slate-600'
            )}
          >
            Payout Destination
          </label>
          <div
            className={cx(
              'grid grid-cols-2 gap-1 rounded-xl border p-1',
              isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-slate-100/90'
            )}
          >
            <button
              type="button"
              onClick={() => setMethod('upi')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all',
                method === 'upi'
                  ? isDark
                    ? 'bg-slate-800 text-white shadow-sm font-black'
                    : 'bg-white text-slate-950 shadow-sm font-black border border-slate-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              UPI VPA
            </button>
            <button
              type="button"
              onClick={() => setMethod('bank')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all',
                method === 'bank'
                  ? isDark
                    ? 'bg-slate-800 text-white shadow-sm font-black'
                    : 'bg-white text-slate-950 shadow-sm font-black border border-slate-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Bank Account (IMPS)
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="mt-3 space-y-3">
          {method === 'upi' ? (
            <div>
              <label
                htmlFor="modal-upi-id"
                className={cx(
                  'mb-1 block text-[10px] font-bold uppercase tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-600'
                )}
              >
                Enter UPI ID (VPA)
              </label>
              <input
                id="modal-upi-id"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. mobile@paytm or name@oksbi"
                className={cx(
                  'w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold outline-none transition-all',
                  isDark
                    ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                    : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                )}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label
                  className={cx(
                    'mb-1 block text-[10px] font-bold uppercase tracking-wider',
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  )}
                >
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter 9-18 digit account number"
                  className={cx(
                    'w-full rounded-xl border px-3.5 py-2 text-xs font-bold outline-none transition-all',
                    isDark
                      ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className={cx(
                      'mb-1 block text-[10px] font-bold uppercase tracking-wider',
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    )}
                  >
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className={cx(
                      'w-full rounded-xl border px-3 py-2 text-xs font-bold uppercase outline-none transition-all',
                      isDark
                        ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                        : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    )}
                  />
                </div>
                <div>
                  <label
                    className={cx(
                      'mb-1 block text-[10px] font-bold uppercase tracking-wider',
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    )}
                  >
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="As per passbook"
                    className={cx(
                      'w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none transition-all',
                      isDark
                        ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                        : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Amount input */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="modal-withdraw-amount"
                className={cx(
                  'text-[10px] font-bold uppercase tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-600'
                )}
              >
                Withdrawal Amount
              </label>
              <span className={cx('text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Min. ₹50
              </span>
            </div>
            <div className="relative">
              <span
                className={cx(
                  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                ₹
              </span>
              <input
                id="modal-withdraw-amount"
                type="number"
                min={50}
                max={winningsCash}
                placeholder="Min. ₹50"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className={cx(
                  'w-full rounded-xl border py-2.5 pl-8 pr-16 text-xs font-bold outline-none transition-all',
                  isDark
                    ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                    : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                )}
              />
              <button
                type="button"
                onClick={() => setWithdrawAmount(String(winningsCash))}
                className={cx(
                  'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-[10px] font-black transition-all active:scale-95',
                  isDark
                    ? 'border-white/20 bg-slate-800 text-white hover:bg-slate-700'
                    : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                )}
              >
                MAX
              </button>
            </div>
          </div>
        </div>

        {/* Micro Info Note */}
        <div
          className={cx(
            'mt-3.5 flex items-center justify-between text-[10px] font-medium',
            isDark ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> Average transfer: 2 minutes
          </span>
          <span className={cx('flex items-center gap-1 font-bold', isDark ? 'text-emerald-400' : 'text-emerald-700')}>
            <ShieldCheck className="h-3.5 w-3.5" /> Zero deduction
          </span>
        </div>

        {/* Payout CTA (Black & White Theme - NO YELLOW) */}
        <button
          type="button"
          disabled={!isEligible || busy}
          onClick={handleWithdraw}
          className={cx(
            'mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black transition-all active:scale-[0.98]',
            isEligible
              ? isDark
                ? 'bg-white text-slate-950 hover:bg-slate-100 shadow-lg'
                : 'bg-slate-950 text-white hover:bg-slate-800 shadow-md shadow-slate-950/20'
              : isDark
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
          <span>Transfer {formatINR(amountNum)} Instantly</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
