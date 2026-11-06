import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Smartphone,
  Building2,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { QUICK_ADD_AMOUNTS } from '../../data/mockData';
import { PhonePeLogo, GPayLogo, PaytmLogo, BhimUpiLogo } from '../common/PaymentLogos';

interface AddCashModalProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
  addAmount: string;
  setAddAmount: (val: string) => void;
  onDeposit: () => void;
}

type PaymentMethodType = 'upi' | 'netbanking' | 'cards';

const POPULAR_UPI = [
  { id: 'phonepe', name: 'PhonePe', type: 'phonepe' },
  { id: 'gpay', name: 'Google Pay', type: 'gpay' },
  { id: 'paytm', name: 'Paytm UPI', type: 'paytm' },
  { id: 'bhim', name: 'BHIM / Any UPI', type: 'bhim' },
];

const POPULAR_BANKS = [
  { id: 'hdfc', name: 'HDFC Bank' },
  { id: 'sbi', name: 'State Bank of India' },
  { id: 'icici', name: 'ICICI Bank' },
  { id: 'axis', name: 'Axis Bank' },
];

export function AddCashModal({
  theme,
  isOpen,
  onClose,
  addAmount,
  setAddAmount,
  onDeposit,
}: AddCashModalProps) {
  const isDark = theme === 'dark';
  const [method, setMethod] = useState<PaymentMethodType>('upi');
  const [selectedUpi, setSelectedUpi] = useState('phonepe');
  const [selectedBank, setSelectedBank] = useState('hdfc');
  const [customUpiId, setCustomUpiId] = useState('');

  if (!isOpen) return null;

  const handlePay = () => {
    onDeposit();
    onClose();
  };

  const amountNum = Number(addAmount) || 0;

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
                Instant Deposit
              </span>
              <span className={cx('text-[10px] font-bold', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                • Zero Fee
              </span>
            </div>
            <h2 className={cx('mt-0.5 text-lg font-black', isDark ? 'text-white' : 'text-slate-950')}>
              Add Cash to Wallet
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close add cash modal"
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

        {/* 1. Amount Selection */}
        <div className="space-y-2">
          <label
            className={cx(
              'block text-[10px] font-bold uppercase tracking-wider',
              isDark ? 'text-slate-400' : 'text-slate-600'
            )}
          >
            Select Deposit Amount
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_ADD_AMOUNTS.map((amt) => {
              const isSelected = Number(addAmount) === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAddAmount(String(amt))}
                  className={cx(
                    'rounded-xl border py-2 text-xs font-black transition-all active:scale-95',
                    isSelected
                      ? isDark
                        ? 'border-white bg-white text-slate-950 font-black shadow-sm'
                        : 'border-slate-950 bg-slate-950 text-white font-black shadow-md'
                      : isDark
                      ? 'border-white/10 bg-slate-800/80 text-slate-300 hover:border-white/20 hover:text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 font-bold'
                  )}
                >
                  +₹{amt}
                </button>
              );
            })}
          </div>

          {/* Custom Amount input */}
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
              type="number"
              min={10}
              placeholder="Or enter custom amount (Min. ₹10)"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className={cx(
                'w-full rounded-xl border py-2.5 pl-8 pr-4 text-xs font-bold outline-none transition-all',
                isDark
                  ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                  : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
              )}
            />
          </div>
        </div>

        {/* 2. Payment Method Selector Tabs */}
        <div className="mt-4 space-y-2">
          <label
            className={cx(
              'block text-[10px] font-bold uppercase tracking-wider',
              isDark ? 'text-slate-400' : 'text-slate-600'
            )}
          >
            Choose Payment Method
          </label>

          <div
            className={cx(
              'grid grid-cols-3 gap-1 rounded-xl border p-1',
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
              UPI
            </button>
            <button
              type="button"
              onClick={() => setMethod('netbanking')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all',
                method === 'netbanking'
                  ? isDark
                    ? 'bg-slate-800 text-white shadow-sm font-black'
                    : 'bg-white text-slate-950 shadow-sm font-black border border-slate-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Net Banking
            </button>
            <button
              type="button"
              onClick={() => setMethod('cards')}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all',
                method === 'cards'
                  ? isDark
                    ? 'bg-slate-800 text-white shadow-sm font-black'
                    : 'bg-white text-slate-950 shadow-sm font-black border border-slate-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
        </div>

        {/* 3. Method Content */}
        <div className="mt-3">
          {method === 'upi' && (
            <div className="space-y-2.5">
              {/* Popular UPI Apps */}
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_UPI.map((app) => {
                  const isSelected = selectedUpi === app.id;
                  const renderUpiIcon = () => {
                    if (app.type === 'phonepe') {
                      return (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#5F259F] p-0.5 shadow-sm">
                          <PhonePeLogo className="h-full w-full" />
                        </div>
                      );
                    }
                    if (app.type === 'gpay') {
                      return (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                          <GPayLogo className="h-full w-full" />
                        </div>
                      );
                    }
                    if (app.type === 'paytm') {
                      return (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                          <PaytmLogo />
                        </div>
                      );
                    }
                    return (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                        <BhimUpiLogo className="h-full w-full" />
                      </div>
                    );
                  };

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedUpi(app.id)}
                      className={cx(
                        'flex items-center justify-between rounded-xl border p-2.5 text-left transition-all active:scale-98',
                        isSelected
                          ? isDark
                            ? 'border-white bg-slate-800/90 text-white'
                            : 'border-slate-950 bg-slate-950/[0.04] text-slate-950 ring-1 ring-slate-950 shadow-xs font-black'
                          : isDark
                          ? 'border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {renderUpiIcon()}
                        <span className="text-xs font-bold">{app.name}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          className={cx(
                            'h-4 w-4 shrink-0',
                            isDark ? 'text-emerald-400' : 'text-emerald-600'
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Or Enter UPI ID */}
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Or enter UPI ID (e.g. mobile@upi)"
                  value={customUpiId}
                  onChange={(e) => setCustomUpiId(e.target.value)}
                  className={cx(
                    'w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold outline-none transition-all',
                    isDark
                      ? 'border-white/15 bg-slate-950 text-white focus:border-white'
                      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                  )}
                />
              </div>
            </div>
          )}

          {method === 'netbanking' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_BANKS.map((bank) => {
                  const isSelected = selectedBank === bank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={cx(
                        'flex items-center justify-between rounded-xl border p-2.5 text-left transition-all active:scale-98',
                        isSelected
                          ? isDark
                            ? 'border-white bg-slate-800/90 text-white'
                            : 'border-slate-950 bg-slate-950/[0.04] text-slate-950 ring-1 ring-slate-950 shadow-xs font-black'
                          : isDark
                          ? 'border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span className="text-xs font-bold">{bank.name}</span>
                      {isSelected && (
                        <CheckCircle2
                          className={cx(
                            'h-4 w-4 shrink-0',
                            isDark ? 'text-emerald-400' : 'text-emerald-600'
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className={cx('text-[10px] text-center pt-1 font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
                All Indian banks supported via secure gateway
              </p>
            </div>
          )}

          {method === 'cards' && (
            <div
              className={cx(
                'rounded-xl border p-4 text-center space-y-1.5',
                isDark ? 'border-white/10 bg-slate-950/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-800'
              )}
            >
              <CreditCard className={cx('h-6 w-6 mx-auto', isDark ? 'text-slate-400' : 'text-slate-600')} />
              <p className="text-xs font-bold">Debit & Credit Cards</p>
              <p className={cx('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Visa, MasterCard, RuPay supported with OTP 3D-Secure
              </p>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div
          className={cx(
            'mt-3.5 flex items-center justify-center gap-1.5 text-[10px] font-medium',
            isDark ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          <ShieldCheck className={cx('h-3.5 w-3.5', isDark ? 'text-emerald-400' : 'text-emerald-600')} />
          <span>256-Bit SSL Encrypted • 100% RBI Compliant Gateway</span>
        </div>

        {/* 4. Pay CTA (Black & White Theme - NO YELLOW) */}
        <button
          type="button"
          disabled={amountNum < 10}
          onClick={handlePay}
          className={cx(
            'mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black transition-all active:scale-[0.98]',
            amountNum >= 10
              ? isDark
                ? 'bg-white text-slate-950 hover:bg-slate-100 shadow-lg'
                : 'bg-slate-950 text-white hover:bg-slate-800 shadow-md shadow-slate-950/20'
              : isDark
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          <span>Pay {formatINR(amountNum)}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
