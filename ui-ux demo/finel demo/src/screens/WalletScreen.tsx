import React from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  CheckCircle2,
  Clock3,
  Trophy,
  Copy,
  Check,
} from 'lucide-react';
import { Theme, WalletMode, TxFilter, TransactionItem } from '../types';
import { cx, formatINR } from '../utils/formatters';
import { QUICK_ADD_AMOUNTS, TX_FILTERS } from '../data/mockData';

interface WalletScreenProps {
  theme: Theme;
  depositCash: number;
  winningsCash: number;
  walletMode: WalletMode;
  setWalletMode: (mode: WalletMode) => void;
  addAmount: string;
  setAddAmount: (value: string) => void;
  upiId: string;
  setUpiId: (value: string) => void;
  withdrawAmount: string;
  setWithdrawAmount: (value: string) => void;
  transactions: TransactionItem[];
  txFilter: TxFilter;
  setTxFilter: (filter: TxFilter) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  copiedReference: string | null;
  onCopy: (reference: string) => void;
}

export function WalletScreen({
  theme,
  depositCash,
  winningsCash,
  walletMode,
  setWalletMode,
  addAmount,
  setAddAmount,
  upiId,
  setUpiId,
  withdrawAmount,
  setWithdrawAmount,
  transactions,
  txFilter,
  setTxFilter,
  onDeposit,
  onWithdraw,
  copiedReference,
  onCopy,
}: WalletScreenProps) {
  const isDark = theme === 'dark';
  const total = depositCash + winningsCash;
  const filtered =
    txFilter === 'All'
      ? transactions
      : transactions.filter((tx) => tx.category === txFilter);

  return (
    <div className="space-y-4">
      {/* Total Arena Balance Card & Dual Ledger */}
      <section
        className={cx(
          'relative overflow-hidden rounded-2xl border p-4 transition-all',
          isDark
            ? 'border-white/10 bg-[#0B1526] text-white shadow-xl'
            : 'border-slate-200 bg-white text-slate-950 shadow-sm'
        )}
      >
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div>
            <span
              className={cx(
                'text-[10px] font-black uppercase tracking-widest',
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              Total Arena Balance
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-400">₹</span>
              <span className="text-3xl font-black tracking-tight">
                {total.toLocaleString('en-IN')}
              </span>
              <span
                className={cx(
                  'ml-2 rounded border px-1.5 py-0.5 text-[9px] font-black tracking-wider',
                  isDark
                    ? 'border-white/10 bg-slate-900 text-slate-300'
                    : 'border-slate-200 bg-slate-100 text-slate-700'
                )}
              >
                LIVE SYNC
              </span>
            </div>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setWalletMode('add')}
              className={cx(
                'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 shadow-sm',
                walletMode === 'add'
                  ? 'bg-[#FFD000] text-slate-950'
                  : isDark
                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Add Cash
            </button>
            <button
              type="button"
              onClick={() => setWalletMode('withdraw')}
              className={cx(
                'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-black transition-all active:scale-95',
                walletMode === 'withdraw'
                  ? isDark
                    ? 'border-white bg-white text-slate-950'
                    : 'border-slate-950 bg-slate-950 text-white'
                  : isDark
                  ? 'border-white/15 bg-transparent text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-transparent text-slate-700 hover:text-slate-950'
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Withdraw
            </button>
          </div>
        </div>

        {/* Dual Ledger: Deposit vs Winnings */}
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2.5">
          <div
            className={cx(
              'rounded-xl border p-3',
              isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cx(
                  'text-[10px] font-black uppercase tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Deposit Cash
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            </div>
            <p className="mt-1 text-lg font-black tracking-tight">{formatINR(depositCash)}</p>
            <p className={cx('mt-0.5 text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              For tournament entry
            </p>
          </div>

          <div
            className={cx(
              'rounded-xl border p-3',
              isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cx(
                  'text-[10px] font-black uppercase tracking-wider',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Winnings Cash
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="mt-1 text-lg font-black tracking-tight">{formatINR(winningsCash)}</p>
            <p className={cx('mt-0.5 text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              100% withdrawable to UPI
            </p>
          </div>
        </div>
      </section>

      {/* Action Box: Add Cash or Withdraw */}
      <section
        className={cx(
          'rounded-2xl border p-4 shadow-sm',
          isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-white'
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {walletMode === 'add' ? (
              <Zap className="h-4 w-4 text-slate-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            )}
            <h2
              className={cx(
                'text-xs font-black uppercase tracking-wider',
                isDark ? 'text-white' : 'text-slate-950'
              )}
            >
              {walletMode === 'add' ? 'Instant Deposit • Zero Fee' : 'Instant UPI Payout'}
            </h2>
          </div>

          <div
            className={cx(
              'inline-flex rounded-lg border p-0.5 text-[10px] font-bold',
              isDark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-slate-100'
            )}
          >
            <button
              type="button"
              onClick={() => setWalletMode('add')}
              className={cx(
                'rounded-md px-2.5 py-1 transition-all',
                walletMode === 'add'
                  ? isDark
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-slate-950 text-white font-black'
                  : isDark
                  ? 'text-slate-400'
                  : 'text-slate-600'
              )}
            >
              + Add Cash
            </button>
            <button
              type="button"
              onClick={() => setWalletMode('withdraw')}
              className={cx(
                'rounded-md px-2.5 py-1 transition-all',
                walletMode === 'withdraw'
                  ? isDark
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-slate-950 text-white font-black'
                  : isDark
                  ? 'text-slate-400'
                  : 'text-slate-600'
              )}
            >
              Withdraw
            </button>
          </div>
        </div>

        {walletMode === 'add' ? (
          <div className="space-y-3">
            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_ADD_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setAddAmount(String(amount))}
                  className={cx(
                    'rounded-lg border px-2 py-1.5 text-xs font-black transition-all active:scale-95',
                    Number(addAmount) === amount
                      ? isDark
                        ? 'border-white bg-white text-slate-950'
                        : 'border-slate-950 bg-slate-950 text-white'
                      : isDark
                      ? 'border-white/10 bg-slate-900 text-slate-300 hover:text-white'
                      : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
                  )}
                >
                  +₹{amount}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min={10}
                value={addAmount}
                onChange={(event) => setAddAmount(event.target.value)}
                aria-label="Deposit Amount"
                className={cx(
                  'w-full rounded-xl border py-2.5 pl-8 pr-4 text-sm font-black outline-none transition-all',
                  isDark
                    ? 'border-white/15 bg-[#081120] text-white focus:border-white'
                    : 'border-slate-300 bg-white text-slate-950 focus:border-slate-900'
                )}
              />
            </div>

            <button
              type="button"
              onClick={onDeposit}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FFD000] px-4 py-3 text-xs font-black text-slate-950 shadow-md shadow-amber-400/20 transition-all hover:bg-[#FFDA29] active:scale-[0.97]"
            >
              <Zap className="h-4 w-4 fill-slate-950" /> Pay {formatINR(Number(addAmount) || 0)} via UPI
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="wallet-upi"
                className={cx(
                  'mb-1 block text-[10px] font-black uppercase tracking-wider',
                  isDark ? 'text-slate-300' : 'text-slate-700'
                )}
              >
                Verified UPI ID
              </label>
              <input
                id="wallet-upi"
                value={upiId}
                onChange={(event) => setUpiId(event.target.value)}
                placeholder="player@oksbi"
                className={cx(
                  'w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold outline-none transition-all',
                  isDark
                    ? 'border-white/15 bg-[#081120] text-white focus:border-white'
                    : 'border-slate-300 bg-white text-slate-950 focus:border-slate-900'
                )}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="withdraw-amount"
                  className={cx(
                    'text-[10px] font-black uppercase tracking-wider',
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  )}
                >
                  Withdrawal Amount
                </label>
                <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Available: {formatINR(winningsCash)}
                </span>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                  ₹
                </span>
                <input
                  id="withdraw-amount"
                  type="number"
                  min={50}
                  max={winningsCash}
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  className={cx(
                    'w-full rounded-xl border py-2.5 pl-8 pr-16 text-sm font-black outline-none transition-all',
                    isDark
                      ? 'border-white/15 bg-[#081120] text-white focus:border-white'
                      : 'border-slate-300 bg-white text-slate-950 focus:border-slate-900'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(String(winningsCash))}
                  className={cx(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-md border px-2 py-0.5 text-[10px] font-black',
                    isDark
                      ? 'border-white/20 bg-slate-800 text-white'
                      : 'border-slate-300 bg-slate-100 text-slate-900'
                  )}
                >
                  Max
                </button>
              </div>
            </div>

            <p className={cx('flex items-center gap-1 text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              <Clock3 className="h-3 w-3 text-slate-400" /> Min. withdrawal ₹50 • Zero fee • Instant 2-min transfer
            </p>

            <button
              type="button"
              onClick={onWithdraw}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FFD000] px-4 py-3 text-xs font-black text-slate-950 shadow-md transition-all hover:bg-[#FFDA29] active:scale-[0.97]"
            >
              <ArrowUpRight className="h-4 w-4" /> Transfer to UPI Now
            </button>
          </div>
        )}
      </section>

      {/* Transaction Records */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3
            className={cx(
              'text-xs font-black uppercase tracking-wider',
              isDark ? 'text-slate-200' : 'text-slate-900'
            )}
          >
            Recent Transactions
          </h3>
          <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {filtered.length} Records
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {TX_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTxFilter(filter)}
              className={cx(
                'shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95',
                txFilter === filter
                  ? isDark
                    ? 'border-white bg-white text-slate-950 font-black'
                    : 'border-slate-950 bg-slate-950 text-white font-black shadow-sm'
                  : isDark
                  ? 'border-white/10 bg-[#0B1526] text-slate-300 hover:text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((tx) => (
            <div
              key={tx.id}
              className={cx(
                'rounded-xl border p-3.5 transition-all',
                isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-white shadow-sm'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className={cx(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      isDark ? 'border-white/10 bg-slate-900 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-800'
                    )}
                  >
                    {tx.category === 'Winnings' ? (
                      <Trophy className="h-4 w-4" />
                    ) : tx.isCredit ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cx('truncate text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>
                      {tx.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cx(
                          'rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                          isDark
                            ? 'border-white/10 bg-slate-900 text-slate-300'
                            : 'border-slate-200 bg-slate-100 text-slate-800'
                        )}
                      >
                        {tx.badgeText}
                      </span>
                      <span className={cx('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {tx.time}
                      </span>
                      <span className="text-slate-400">•</span>
                      <button
                        type="button"
                        onClick={() => onCopy(tx.reference)}
                        className={cx(
                          'inline-flex items-center gap-1 font-mono text-[10px] transition-colors',
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950'
                        )}
                      >
                        {tx.reference}
                        {copiedReference === tx.reference ? (
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <span
                  className={cx(
                    'shrink-0 text-xs font-black',
                    tx.isCredit
                      ? 'text-emerald-500'
                      : isDark
                      ? 'text-white'
                      : 'text-slate-950'
                  )}
                >
                  {tx.isCredit ? '+' : '-'}
                  {formatINR(tx.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
