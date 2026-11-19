import React from 'react';
import { Crosshair, Gamepad2, MapPin, ShieldAlert, Trophy } from 'lucide-react';
import { MyMatch, Theme } from '../../types';
import { cx, formatINR } from '../../utils/formatters';
import { formatKickoffStamp, formatNet, matchTiming, myMatchAction, myMatchPill, MyMatchTone } from '../../lib/mappers';

const TONE: Record<MyMatchTone, { dark: string; light: string }> = {
  cyan: { dark: 'bg-[#00C2FF]/15 text-[#00C2FF]', light: 'bg-cyan-50 text-cyan-700' },
  amber: { dark: 'bg-amber-400/15 text-amber-300', light: 'bg-amber-50 text-amber-700' },
  rose: { dark: 'bg-rose-500/15 text-rose-300', light: 'bg-rose-50 text-rose-700' },
  emerald: { dark: 'bg-emerald-500/15 text-emerald-300', light: 'bg-emerald-50 text-emerald-700' },
  gold: { dark: 'bg-[#FFD000]/15 text-[#FFD000]', light: 'bg-yellow-50 text-yellow-700' },
  slate: { dark: 'bg-slate-500/15 text-slate-300', light: 'bg-slate-100 text-slate-600' },
};

interface MyMatchCardProps {
  theme: Theme;
  match: MyMatch;
  onRoom: () => void;
}

/**
 * One seat from the player's history.
 *
 * Same visual language as the lobby's `MatchCard` (map/mode chips, match
 * number, IST stamp, money strip) but the action area is a **status**, never a
 * Join button — this list is a record, not a storefront.
 */
export function MyMatchCard({ theme, match, onRoom }: MyMatchCardProps) {
  const isDark = theme === 'dark';
  const pill = myMatchPill(match);
  const action = myMatchAction(match);
  const result = match.result;
  const isSettled = match.phase === 'completed' || match.phase === 'cancelled';
  const timing = isSettled ? '' : matchTiming(match.kickoffIso, match.phase);
  const isLive = match.phase === 'live';

  const handleAction = () => {
    if (action.kind === 'room') onRoom();
  };

  return (
    <article
      className={cx(
        'rounded-2xl border p-3.5 transition-all',
        isDark ? 'border-white/10 bg-[#0B1526]/85' : 'border-slate-200 bg-white shadow-sm'
      )}
    >
      {/* Match number + map + mode, status pill on the right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {match.matchNumber != null && (
            <span className="inline-flex items-center rounded-md bg-[#00C2FF]/15 px-2 py-0.5 text-[11px] font-black text-[#00C2FF]">
              {match.matchNumber}
            </span>
          )}
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold',
              isDark ? 'border-white/10 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <MapPin className="h-2.5 w-2.5 text-[#00C2FF]" />
            {match.map}
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider',
              isDark ? 'border-white/10 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-800'
            )}
          >
            <Gamepad2 className="h-2.5 w-2.5" />
            {match.modeChip}
          </span>
        </div>

        <span
          className={cx(
            'shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide',
            isDark ? TONE[pill.tone].dark : TONE[pill.tone].light
          )}
        >
          {pill.label}
        </span>
      </div>

      {/* Title + kickoff stamp */}
      <p className={cx('mt-1.5 truncate text-[12px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
        {match.title}
      </p>
      <p className={cx('mt-0.5 text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
        {formatKickoffStamp(match.kickoffIso)} · Slot {String(match.slotNumber).padStart(2, '0')} · Entry {formatINR(match.entryFee)}
      </p>

      {/* Result strip — rank, kills, prize and the money outcome */}
      {isSettled && (
        <div
          className={cx(
            'mt-2.5 flex items-center justify-between rounded-xl border px-3 py-2',
            isDark ? 'border-white/5 bg-slate-900/75' : 'border-slate-200 bg-slate-50'
          )}
        >
          {result ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black',
                    result.rank === 1
                      ? isDark
                        ? 'bg-[#FFD000]/20 text-[#FFD000]'
                        : 'bg-yellow-100 text-yellow-700'
                      : isDark
                      ? 'bg-white/10 text-slate-200'
                      : 'bg-slate-200 text-slate-700'
                  )}
                >
                  {result.rank != null ? `#${result.rank}` : '—'}
                </span>
                <div className="leading-tight">
                  <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {result.rank === 1 ? 'Booyah' : 'Placement'}
                  </span>
                  <span className={cx('text-[11px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
                    {result.rank != null ? `Rank #${result.rank}` : 'Unranked'}
                  </span>
                </div>
              </div>

              <div className="text-center leading-tight">
                <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Kills
                </span>
                <span className={cx('inline-flex items-center gap-1 text-[11px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
                  <Crosshair className="h-3 w-3 text-slate-400" />
                  {result.kills}
                </span>
              </div>

              <div className="text-right leading-tight">
                <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {match.refunded && !result.prizeWon ? 'Refund' : 'Prize'}
                </span>
                <span
                  className={cx(
                    'inline-flex items-center gap-1 text-[11px] font-black',
                    result.prizeWon > 0 ? 'text-emerald-400' : isDark ? 'text-slate-300' : 'text-slate-600'
                  )}
                >
                  {result.prizeWon > 0 && <Trophy className="h-3 w-3" />}
                  {formatINR(match.refunded && !result.prizeWon ? match.refundAmount : result.prizeWon)}
                </span>
              </div>
            </>
          ) : (
            <p className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {match.refunded
                ? `Match cancelled — ${formatINR(match.refundAmount)} refunded to your wallet.`
                : 'Result not published yet — the organiser is verifying this match.'}
            </p>
          )}
        </div>
      )}

      {/* Ban / disqualification note (never hidden behind a tap) */}
      {(match.isBannedFromMatch || result?.isDisqualified) && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] font-bold text-rose-400">
          <ShieldAlert className="mt-px h-3 w-3 shrink-0" />
          {match.banReason?.trim() ||
            result?.disqualifyReason?.trim() ||
            'Removed from this match by the organiser.'}
        </p>
      )}

      {/* Status action — the replacement for the lobby's Join button */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {isSettled ? 'Net result' : isLive ? 'Status' : timing ? 'Starts' : 'Your seat'}
          </span>
          <span
            className={cx(
              'text-[11px] font-black',
              !isSettled
                ? isDark
                  ? 'text-white'
                  : 'text-slate-950'
                : match.net == null
                ? isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
                : match.net > 0
                ? 'text-emerald-400'
                : match.net < 0
                ? 'text-rose-400'
                : isDark
                ? 'text-slate-300'
                : 'text-slate-700'
            )}
          >
            {isSettled
              ? match.net == null
                ? '—'
                : formatNet(match.net)
              : timing || `Slot ${String(match.slotNumber).padStart(2, '0')}`}
          </span>
        </div>

        <button
          type="button"
          disabled={action.kind === 'pending' || action.kind === 'none'}
          onClick={handleAction}
          className={cx(
            'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all',
            action.kind === 'pending' || action.kind === 'none'
              ? isDark
                ? 'cursor-default bg-white/5 text-slate-400'
                : 'cursor-default bg-slate-100 text-slate-500'
              : 'bg-[#FFD000] text-slate-950 hover:bg-[#FFDA29] active:scale-[0.96]'
          )}
        >
          {action.label}
        </button>
      </div>

      {/* Delay is already on the pill + STARTS column — no extra paragraph. */}
    </article>
  );
}
