import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Theme, WalletMode, TxFilter, TransactionItem } from '../types';
import { cx, formatINR } from '../utils/formatters';
import { TX_FILTERS } from '../data/mockData';
import { AddCashModal } from '../components/modals/AddCashModal';
import { WithdrawModal } from '../components/modals/WithdrawModal';
import { TransactionDetailModal } from '../components/modals/TransactionDetailModal';
import {
  UpiStack,
  PhonePeBadge,
  PaytmBadge,
  GPayBadge,
  BankBadge,
  FreeFireWinBadge,
  FreeFireCombatBadge,
} from '../components/common/PaymentLogos';

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

  // Popups state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* 1. Realistic Premium Arena Vault Card */}
      <section
        className={cx(
          'relative overflow-hidden rounded-2xl p-4 transition-all shadow-lg',
          isDark
            ? 'border border-white/20 bg-gradient-to-br from-[#0F1E36] via-[#0B1526] to-[#070D18] text-white shadow-black/50'
            : 'border border-slate-900/20 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-slate-200/60'
        )}
      >
        {/* Total Balance Header Row: Left = Overlapping Payment Logos (User's sketch), Right = Total Balance */}
        <div
          className={cx(
            'flex items-center justify-between gap-3 border-b pb-3',
            isDark ? 'border-white/15' : 'border-slate-900/15'
          )}
        >
          {/* Left: 5 Overlapping Payment Circles (PhonePe, GPay, Paytm, BHIM UPI, WhatsApp) */}
          <UpiStack isDark={isDark} />

          {/* Right: Total Balance */}
          <div className="flex flex-col items-end text-right">
            <span
              className={cx(
                'text-[9px] font-bold uppercase tracking-widest',
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              Total Balance
            </span>
            <span
              className={cx(
                'text-2xl sm:text-3xl font-black tracking-tight leading-none mt-0.5',
                isDark ? 'text-white' : 'text-slate-950'
              )}
            >
              {formatINR(total)}
            </span>
          </div>
        </div>

        {/* 2. Tangible Real-Money Ledger (Deposit Cash vs Withdrawable Winnings) */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {/* Card A: Deposit Cash with its own Add Cash button */}
          <div
            className={cx(
              'flex flex-col justify-between rounded-xl p-3 transition-all',
              isDark
                ? 'border border-white/20 bg-slate-950/70 hover:border-white/35'
                : 'border border-slate-900/20 bg-white hover:border-slate-900/35'
            )}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Deposit Cash
              </span>

              {/* Amount */}
              <p className={cx('mt-1 text-xl font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
                {formatINR(depositCash)}
              </p>
            </div>

            {/* Direct Add Cash Button */}
            <button
              type="button"
              onClick={() => {
                setWalletMode('add');
                setIsAddOpen(true);
              }}
              className={cx(
                'mt-2.5 flex w-full items-center justify-center rounded-lg py-1.5 px-3 text-[11px] font-bold transition-all active:scale-95 shadow-xs',
                isDark
                  ? 'border border-white/25 bg-slate-900/90 text-white hover:bg-slate-800 hover:border-white/40'
                  : 'border border-slate-900/25 bg-white text-slate-900 hover:bg-slate-100 hover:border-slate-900/40'
              )}
            >
              Add Cash
            </button>
          </div>

          {/* Card B: Winnings Cash with its own Withdraw button */}
          <div
            className={cx(
              'flex flex-col justify-between rounded-xl p-3 transition-all',
              isDark
                ? 'border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-slate-950/70 to-slate-950/90 hover:border-emerald-400/60'
                : 'border border-emerald-600/30 bg-gradient-to-b from-emerald-50/80 via-white to-white hover:border-emerald-600/50'
            )}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Winnings Cash
              </span>

              {/* Amount */}
              <p className="mt-1 text-xl font-black tracking-tight text-emerald-500">
                {formatINR(winningsCash)}
              </p>
            </div>

            {/* Direct Withdraw Button */}
            <button
              type="button"
              onClick={() => {
                setWalletMode('withdraw');
                setIsWithdrawOpen(true);
              }}
              className={cx(
                'mt-2.5 flex w-full items-center justify-center rounded-lg py-1.5 px-3 text-[11px] font-bold transition-all active:scale-95 shadow-xs',
                isDark
                  ? 'border border-white/25 bg-slate-900/90 text-white hover:bg-slate-800 hover:border-white/40'
                  : 'border border-slate-900/25 bg-white text-slate-900 hover:bg-slate-100 hover:border-slate-900/40'
              )}
            >
              Withdraw
            </button>
          </div>
        </div>
      </section>

      {/* 4. Real Authentic Gaming Passbook & Transaction Ledger */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3
              className={cx(
                'text-xs font-black uppercase tracking-wider',
                isDark ? 'text-slate-200' : 'text-slate-900'
              )}
            >
              Account Passbook
            </h3>
          </div>
          <span className={cx('text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Tap for receipt
          </span>
        </div>

        {/* Clean Filter Tabs (No Numbers) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {TX_FILTERS.map((filter) => {
            const isSelected = txFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setTxFilter(filter)}
                className={cx(
                  'shrink-0 flex items-center justify-center rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95',
                  isSelected
                    ? isDark
                      ? 'border-white bg-white text-slate-950 font-black shadow-sm'
                      : 'border-slate-950 bg-slate-950 text-white font-black shadow-sm'
                    : isDark
                    ? 'border-white/10 bg-[#0B1526]/80 text-slate-400 hover:text-white hover:border-white/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                )}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Unified Continuous Ledger Container */}
        {filtered.length === 0 ? (
          <div
            className={cx(
              'rounded-2xl border py-8 text-center',
              isDark ? 'border-white/10 bg-[#0B1526]/50 text-slate-400' : 'border-slate-200 bg-white text-slate-500'
            )}
          >
            <p className="text-xs font-bold">No passbook records found</p>
            <p className="text-[10px] mt-0.5">Try selecting "All" or another category filter.</p>
          </div>
        ) : (
          <div
            className={cx(
              'overflow-hidden rounded-2xl border transition-all',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-white shadow-xs'
            )}
          >
            {/* Group transactions by dateGroup */}
            {Object.entries(
              filtered.reduce<Record<string, TransactionItem[]>>((acc, tx) => {
                const group = tx.dateGroup || 'TODAY';
                if (!acc[group]) acc[group] = [];
                acc[group].push(tx);
                return acc;
              }, {})
            ).map(([groupTitle, txList], groupIdx) => (
              <div key={groupTitle}>
                {/* Date Group Header */}
                <div
                  className={cx(
                    'flex items-center justify-between px-3.5 py-2 border-b text-[9px] font-black uppercase tracking-widest',
                    isDark
                      ? 'border-white/10 bg-slate-900/70 text-slate-400'
                      : 'border-slate-100 bg-slate-50 text-slate-500',
                    groupIdx > 0 && (isDark ? 'border-t border-white/10' : 'border-t border-slate-200')
                  )}
                >
                  <span>{groupTitle}</span>
                  <span className="text-[8px] font-bold text-slate-400">
                    {txList.length} {txList.length === 1 ? 'RECORD' : 'RECORDS'}
                  </span>
                </div>

                {/* Ledger Rows */}
                <div className={cx('divide-y', isDark ? 'divide-white/5' : 'divide-slate-100')}>
                  {txList.map((tx) => {
                    const renderBadge = () => {
                      if (tx.channel === 'phonepe') return <PhonePeBadge isDark={isDark} />;
                      if (tx.channel === 'paytm') return <PaytmBadge isDark={isDark} />;
                      if (tx.channel === 'gpay') return <GPayBadge isDark={isDark} />;
                      if (tx.channel === 'bank') return <BankBadge isDark={isDark} />;
                      if (tx.category === 'Winnings' || tx.channel === 'freefire_win')
                        return <FreeFireWinBadge isDark={isDark} />;
                      if (tx.category === 'Entries' || tx.channel === 'freefire_entry')
                        return <FreeFireCombatBadge isDark={isDark} />;
                      if (tx.category === 'Deposits') return <PhonePeBadge isDark={isDark} />;
                      if (tx.category === 'Withdrawals') return <PaytmBadge isDark={isDark} />;
                      return <FreeFireCombatBadge isDark={isDark} />;
                    };

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSelectedTx(tx);
                          setIsDetailOpen(true);
                        }}
                        className={cx(
                          'group flex items-center justify-between gap-3 px-3.5 py-3 transition-colors cursor-pointer active:bg-black/5 dark:active:bg-white/5',
                          isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'
                        )}
                      >
                        {/* Left: Authentic Brand Badge + Title & Context */}
                        <div className="flex min-w-0 items-center gap-3">
                          {renderBadge()}

                          <div className="min-w-0">
                            <p
                              className={cx(
                                'truncate text-xs font-bold leading-tight',
                                isDark ? 'text-white' : 'text-slate-900'
                              )}
                            >
                              {tx.category === 'Winnings' && tx.map
                                ? `Match Winnings | ${tx.map}`
                                : tx.category === 'Entries' && tx.map
                                ? `Entry Fee | ${tx.map}`
                                : tx.title.replace(/[—–-]/g, '|').replace(/\s+Cup(\s*#\d+)?/gi, '')}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                              {tx.category === 'Winnings' && (
                                <>
                                  <span className="font-semibold text-amber-400">
                                    {tx.matchMode || 'Solo'}
                                  </span>
                                  <span>•</span>
                                  <span>UID: {tx.playerUid || '84920194'}</span>
                                  <span>•</span>
                                  <span>{tx.time}</span>
                                </>
                              )}

                              {tx.category === 'Entries' && (
                                <>
                                  <span className="font-semibold text-cyan-400">
                                    {tx.matchMode || 'Match'}
                                  </span>
                                  <span>•</span>
                                  <span className="text-slate-300 dark:text-slate-300">
                                    {tx.map || 'Bermuda'}
                                  </span>
                                  <span>•</span>
                                  <span>{tx.time}</span>
                                </>
                              )}

                              {tx.category === 'Deposits' && (
                                <>
                                  <span className="font-semibold text-emerald-400">
                                    Deposit Wallet
                                  </span>
                                  <span>•</span>
                                  <span>{tx.time}</span>
                                </>
                              )}

                              {tx.category === 'Withdrawals' && (
                                <>
                                  <span className="font-semibold text-violet-400">
                                    {tx.payoutMethod || 'Instant IMPS'}
                                  </span>
                                  <span>•</span>
                                  <span>{tx.time}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount & Closing Balance */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="flex flex-col items-end text-right">
                            <span
                              className={cx(
                                'text-xs sm:text-sm font-black tracking-tight leading-none',
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

                            {tx.closingBalance !== undefined && (
                              <span
                                className={cx(
                                  'mt-1 font-mono text-[9px] font-medium leading-none',
                                  isDark ? 'text-slate-500' : 'text-slate-400'
                                )}
                              >
                                Bal: {formatINR(tx.closingBalance)}
                              </span>
                            )}
                          </div>

                          <ChevronRight
                            className={cx(
                              'h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5',
                              isDark ? 'text-slate-400' : 'text-slate-600'
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Popups / Modals */}
      <AddCashModal
        theme={theme}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        addAmount={addAmount}
        setAddAmount={setAddAmount}
        onDeposit={onDeposit}
      />

      <WithdrawModal
        theme={theme}
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        winningsCash={winningsCash}
        upiId={upiId}
        setUpiId={setUpiId}
        withdrawAmount={withdrawAmount}
        setWithdrawAmount={setWithdrawAmount}
        onWithdraw={onWithdraw}
      />

      {/* 6. Transaction Receipt Detail Modal */}
      <TransactionDetailModal
        theme={theme}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTx(null);
        }}
        transaction={selectedTx}
      />
    </div>
  );
}
