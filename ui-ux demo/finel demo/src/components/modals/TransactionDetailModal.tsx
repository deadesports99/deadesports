import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  Trophy,
  Swords,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { Theme, TransactionItem } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { PhonePeLogo } from '../common/PaymentLogos';

interface TransactionDetailModalProps {
  theme: Theme;
  transaction: TransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailModal({
  theme,
  transaction,
  isOpen,
  onClose,
}: TransactionDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const isDark = theme === 'dark';

  if (!isOpen || !transaction) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText?.(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Category Icon & Color scheme
  const getCategoryMeta = () => {
    switch (transaction.category) {
      case 'Winnings':
        return {
          icon: Trophy,
          label: 'Tournament Prize Winnings',
          subLabel: 'Credited to Winnings Balance',
          color: 'text-amber-400',
          bg: isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200 text-amber-700',
        };
      case 'Entries':
        return {
          icon: Swords,
          label: 'Match Entry Fee',
          subLabel: 'Deducted from Deposit Balance',
          color: 'text-cyan-400',
          bg: isDark ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200 text-cyan-700',
        };
      case 'Deposits':
        return {
          icon: ArrowDownLeft,
          label: 'UPI Wallet Deposit',
          subLabel: 'Credited to Deposit Balance',
          color: 'text-emerald-400',
          bg: isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
        };
      case 'Withdrawals':
        return {
          icon: ArrowUpRight,
          label: 'Instant UPI / Bank Payout',
          subLabel: 'Deducted from Winnings Balance',
          color: 'text-violet-400',
          bg: isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200 text-violet-700',
        };
      default:
        return {
          icon: CheckCircle2,
          label: 'Wallet Transaction',
          subLabel: 'Completed',
          color: 'text-slate-400',
          bg: isDark ? 'bg-slate-800 border-white/20' : 'bg-slate-100 border-slate-200',
        };
    }
  };

  const meta = getCategoryMeta();
  const IconComponent = meta.icon;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal / Sheet Container */}
      <div
        className={cx(
          'relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-5 shadow-2xl transition-all max-h-[90vh] overflow-y-auto pb-8 sm:pb-6',
          isDark
            ? 'border-white/20 bg-[#0A1322] text-white shadow-black/80'
            : 'border-slate-300 bg-white text-slate-900 shadow-slate-400/50'
        )}
      >
        {/* Top Handle on Mobile */}
        <div className="mx-auto -mt-1.5 mb-3 h-1.5 w-12 rounded-full bg-slate-500/40 sm:hidden" />

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b pb-3 border-inherit/20">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                meta.bg
              )}
            >
              {transaction.category}
            </span>
            <span className="text-xs font-bold text-slate-400">Transaction Receipt</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt modal"
            className={cx(
              'flex h-7 w-7 items-center justify-center rounded-full border transition-all active:scale-95',
              isDark
                ? 'border-white/20 bg-slate-900 text-slate-300 hover:text-white'
                : 'border-slate-300 bg-slate-100 text-slate-600 hover:text-slate-950'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Big Amount & Status Center Hero */}
        <div className="my-5 flex flex-col items-center text-center">
          {transaction.category === 'Winnings' || transaction.channel === 'freefire_win' ? (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden border border-amber-400/50 shadow-lg shadow-amber-500/20 mb-2.5 bg-[#081326]">
              <img src="/assets/games/freefire/icon.png" alt="Free Fire" className="h-full w-full object-cover" />
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 ring-2 ring-slate-950 shadow-xs">
                <Trophy className="h-3 w-3 fill-current" />
              </div>
            </div>
          ) : transaction.category === 'Entries' || transaction.channel === 'freefire_entry' ? (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden border border-cyan-400/50 shadow-lg shadow-cyan-500/20 mb-2.5 bg-[#081326]">
              <img src="/assets/games/freefire/icon.png" alt="Free Fire" className="h-full w-full object-cover" />
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-slate-950 ring-2 ring-slate-950 shadow-xs">
                <Swords className="h-3 w-3" />
              </div>
            </div>
          ) : transaction.channel === 'phonepe' || transaction.payoutMethod?.toLowerCase().includes('phonepe') || transaction.title?.toLowerCase().includes('phonepe') ? (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5F259F] p-2.5 border border-white/20 shadow-lg shadow-purple-500/30 mb-2.5">
              <PhonePeLogo className="h-full w-full" />
            </div>
          ) : (
            <div
              className={cx(
                'flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg mb-2.5',
                meta.bg
              )}
            >
              <IconComponent className={cx('h-7 w-7', meta.color)} />
            </div>
          )}

          <span
            className={cx(
              'text-3xl font-black tracking-tight',
              transaction.isCredit ? 'text-emerald-500' : isDark ? 'text-white' : 'text-slate-950'
            )}
          >
            {transaction.isCredit ? '+' : '-'}
            {formatINR(transaction.amount)}
          </span>

          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Transaction Successful</span>
          </div>

          <p className="mt-0.5 text-[11px] text-slate-400">{meta.subLabel}</p>
        </div>

        {/* Detailed Breakdown Card */}
        <div
          className={cx(
            'rounded-2xl border p-4 space-y-3',
            isDark ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          )}
        >
          {/* 1. Transaction Title / Match */}
          <div className="flex items-start justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium shrink-0">Item / Purpose</span>
            <span className={cx('font-bold text-right', isDark ? 'text-white' : 'text-slate-900')}>
              {transaction.title}
            </span>
          </div>

          {/* 2. Specific for Winnings & Entries: Match Name & Mode */}
          {(transaction.matchName || transaction.matchMode) && (
            <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
              <span className="text-slate-400 font-medium">Format & Mode</span>
              <span className={cx('font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                {transaction.matchMode || 'Solo'} • {transaction.map || 'Bermuda'}
              </span>
            </div>
          )}

          {/* 3. Free Fire Player UID */}
          {transaction.playerUid && (
            <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
              <span className="text-slate-400 font-medium">Free Fire Player UID</span>
              <span className="font-mono font-bold text-amber-400">{transaction.playerUid}</span>
            </div>
          )}

          {/* 4. Game Result (if Winnings) */}
          {transaction.gameResult && (
            <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
              <span className="text-slate-400 font-medium">Result / Placement</span>
              <span className="font-bold text-emerald-400">{transaction.gameResult}</span>
            </div>
          )}

          {/* 5. Payout or Deposit Method */}
          {transaction.payoutMethod && (
            <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
              <span className="text-slate-400 font-medium">Payment / UPI Channel</span>
              <span className={cx('font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                {transaction.payoutMethod}
              </span>
            </div>
          )}

          {/* 6. Date & Timestamp */}
          <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
            <span className="text-slate-400 font-medium">Date & Time</span>
            <span className={cx('font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
              {transaction.time}
            </span>
          </div>

          {/* 7. Reference Number / Bank UTR */}
          <div className="flex items-center justify-between gap-3 text-xs border-t pt-2.5 border-inherit/15">
            <span className="text-slate-400 font-medium">
              {transaction.category === 'Deposits' || transaction.category === 'Withdrawals'
                ? 'Bank UTR Ref'
                : 'Receipt Ref ID'}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(transaction.reference)}
              className={cx(
                'inline-flex items-center gap-1.5 font-mono text-[11px] font-bold transition-all px-2 py-0.5 rounded border',
                isDark
                  ? 'border-white/15 bg-slate-900 text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:text-slate-950'
              )}
            >
              <span>{transaction.reference}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Security & Verification Assurance */}
        <div
          className={cx(
            'mt-4 flex items-center gap-2 rounded-xl border p-2.5 text-[11px]',
            isDark ? 'border-white/10 bg-[#0B1728] text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
          )}
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Verified ledger record. 100% encrypted & tamper-proof match history.</span>
        </div>

        {/* Bottom Action Buttons */}
        <div className="mt-4 flex gap-2">
          <a
            href="https://wa.me/919876543210"
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition-all active:scale-95',
              isDark
                ? 'border-white/20 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
            )}
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Need Help?</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className={cx(
              'flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all active:scale-95',
              isDark
                ? 'border-white/30 bg-white text-slate-950 font-black hover:bg-slate-200'
                : 'border-slate-950 bg-slate-950 text-white font-black hover:bg-slate-800'
            )}
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
