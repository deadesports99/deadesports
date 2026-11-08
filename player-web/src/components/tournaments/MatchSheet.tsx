import React, { useEffect, useState } from 'react';
import { MapPin, Clock3, X, CheckCircle2, User, Gamepad2, KeyRound, Copy, Check } from 'lucide-react';
import { Theme, TournamentMatch } from '../../types';
import { cx, formatINR } from '../../utils/formatters';

interface MatchSheetProps {
  theme: Theme;
  match: TournamentMatch;
  balance: number;
  joined: boolean;
  onClose: () => void;
  /** Carries the Free Fire identity the organiser needs to seat the player. */
  onJoin: (identity: { inGameName: string; inGameUid: string }) => void;
  onTopUp: () => void;
  /** Prefill from the saved profile (backend: /auth/me). */
  defaultIgn?: string;
  defaultUid?: string;
  /** Server-side error from the join call. */
  joinError?: string;
  joining?: boolean;
  /** Entry closes 1 minute before kickoff. */
  joinClosed?: boolean;
  /**
   * The organiser already published the custom room. `hasCredentials` = the
   * player is seated and may read the Room ID & Password now;
   * `roomPending` = published, but this player has not joined yet — the code
   * unlocks the moment the join succeeds.
   */
  hasCredentials?: boolean;
  roomPending?: boolean;
  room?: { roomId?: string | null; roomPassword?: string | null } | null;
  /** Fired after a successful copy so the app can show a toast. */
  onCopied?: (label: string) => void;
}

const IGN_RE = /^[\s\S]{2,30}$/;
const UID_RE = /^\d{6,12}$/;

export function MatchSheet({  theme,
  match,
  balance,
  joined,
  onClose,
  onJoin,
  onTopUp,
  defaultIgn = '',
  defaultUid = '',
  joinError,
  joining = false,
  joinClosed = false,
  hasCredentials = false,
  roomPending = false,
  room = null,
  onCopied,
}: MatchSheetProps) {
  const isDark = theme === 'dark';
  const [ign, setIgn] = useState(defaultIgn);
  const [uid, setUid] = useState(defaultUid);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyValue = (key: string, label: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText?.(value);
    setCopiedKey(key);
    onCopied?.(label);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  };

  useEffect(() => {
    setIgn(defaultIgn);
    setUid(defaultUid);
  }, [defaultIgn, defaultUid]);

  const ignOk = IGN_RE.test(ign.trim());
  const uidOk = UID_RE.test(uid.trim());
  const identityOk = ignOk && uidOk;
  const roomId = room?.roomId ?? '';
  const roomPass = room?.roomPassword ?? '';
  // The room can be read here only by a seated player; otherwise it is a teaser.
  const showRoomValues = hasCredentials && Boolean(roomId || roomPass);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={cx(
          'max-h-[88%] overflow-y-auto rounded-t-[28px] border-t p-4 shadow-2xl max-w-lg mx-auto w-full transition-all',
          isDark
            ? 'border-white/15 bg-slate-900/95 text-white'
            : 'border-slate-300 bg-white/95 text-slate-950'
        )}
      >
        {/* Grab bar */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-400/40" />

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span
              className={cx(
                'text-[10px] font-black uppercase tracking-widest',
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              Quick Join • {match.modeBadge}
            </span>
            <h2 className="mt-1 text-xl font-black">{match.title}</h2>
            <p className={cx('mt-1 text-xs', isDark ? 'text-slate-400' : 'text-slate-600')}>
              Review your entry before securing a slot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick join"
            className={cx(
              'rounded-lg p-1.5 transition-all active:scale-95',
              isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:text-slate-950'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Map & Mode info grid */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className={cx(
              'rounded-xl border p-3',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
            )}
          >
            <span className="text-[10px] font-bold uppercase text-slate-400">Map & Mode</span>
            <p className="mt-1 text-sm font-black">
              <MapPin className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
              {match.map}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{match.modeBadge}</p>
          </div>
          <div
            className={cx(
              'rounded-xl border p-3',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
            )}
          >
            <span className="text-[10px] font-bold uppercase text-slate-400">Match Time</span>
            <p className="mt-1 text-sm font-black">
              <Clock3 className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
              {match.time}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {hasCredentials ? 'Published by organiser' : 'Unlocks after you join'}
            </p>
          </div>
        </div>

        {/* Prize Pool breakdown */}
        <div
          className={cx(
            'mt-2 grid grid-cols-2 gap-2 rounded-xl border p-3',
            isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
          )}
        >
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Prize Pool</span>
            <p className={cx('mt-1 text-lg font-black', isDark ? 'text-white' : 'text-slate-950')}>
              {formatINR(match.prizePool)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-slate-400">Per Kill</span>
            <p className={cx('mt-1 text-lg font-black', isDark ? 'text-white' : 'text-slate-950')}>
              {match.perKill ? formatINR(match.perKill) : 'Win Only'}
            </p>
          </div>
        </div>

        {/* Free Fire identity — who gets seated in the custom room */}
        <div
          className={cx(
            'mt-2 rounded-xl border p-3',
            isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
          )}
        >
          <span className="text-[10px] font-bold uppercase text-slate-400">Your Free Fire Details</span>

          <label className="mt-2 block">
            <span className={cx('mb-1 flex items-center gap-1.5 text-[11px] font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
              <User className="h-3 w-3" /> In-Game Name (IGN)
            </span>
            <input
              value={ign}
              onChange={(event) => setIgn(event.target.value.slice(0, 30))}
              placeholder="e.g. SpartanOP"
              disabled={joined || joining}
              className={cx(
                'h-11 w-full rounded-lg border px-3 text-[13px] font-bold outline-none transition-all',
                isDark
                  ? 'border-white/15 bg-[#060B14] text-white placeholder:text-slate-600 focus:border-white'
                  : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-black'
              )}
            />
          </label>

          <label className="mt-2 block">
            <span className={cx('mb-1 flex items-center gap-1.5 text-[11px] font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
              <Gamepad2 className="h-3 w-3" /> Free Fire UID
            </span>
            <input
              value={uid}
              inputMode="numeric"
              onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="6-12 digit UID"
              disabled={joined || joining}
              className={cx(
                'h-11 w-full rounded-lg border px-3 text-[13px] font-bold tracking-widest outline-none transition-all',
                isDark
                  ? 'border-white/15 bg-[#060B14] text-white placeholder:text-slate-600 focus:border-white'
                  : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-black'
              )}
            />
          </label>

          {joinError && (
            <p className="mt-2 text-[11px] font-semibold text-rose-500">{joinError}</p>
          )}
          {!identityOk && (ign.trim().length > 0 || uid.trim().length > 0) && (
            <p className={cx('mt-2 text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              IGN needs 2-30 characters and the UID must be 6-12 digits.
            </p>
          )}
        </div>

        {/* Entry fee & wallet balance */}
        <div
          className={cx(
            'mt-4 rounded-xl border p-3',
            isDark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-100/70'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">Entry Fee</span>
            <span className={cx('text-base font-black', isDark ? 'text-white' : 'text-slate-950')}>
              {formatINR(match.entryFee)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-current/10 pt-2">
            <span className="text-xs font-bold">Your Available Balance</span>
            <span
              className={cx(
                'text-base font-black',
                balance >= match.entryFee ? 'text-emerald-500' : 'text-rose-500'
              )}
            >
              {formatINR(balance)}
            </span>
          </div>
          {balance < match.entryFee && (
            <button
              type="button"
              onClick={onTopUp}
              className="mt-2 text-[11px] font-black underline"
            >
              + Top up wallet to continue
            </button>
          )}
        </div>

        {/* Room ID & Password — published by the organiser, readable after joining */}
        {(hasCredentials || roomPending) && (
          <div
            className={cx(
              'mt-2 rounded-xl border p-3',
              isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                <KeyRound className="h-3 w-3" /> Custom Room Details
              </span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide',
                  showRoomValues
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-amber-400/15 text-amber-500'
                )}
              >
                {showRoomValues ? 'Published' : 'Join to unlock'}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <RoomValueRow
                label="Room ID"
                value={showRoomValues ? roomId : ''}
                masked={!showRoomValues}
                copied={copiedKey === 'roomId'}
                isDark={isDark}
                onCopy={() => copyValue('roomId', 'Room ID', roomId)}
              />
              <RoomValueRow
                label="Password"
                value={showRoomValues ? roomPass : ''}
                masked={!showRoomValues}
                copied={copiedKey === 'roomPass'}
                isDark={isDark}
                onCopy={() => copyValue('roomPass', 'Room password', roomPass)}
              />
            </div>

            <p className={cx('mt-2 text-[10px] leading-snug', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {showRoomValues
                ? 'Room is open — copy the ID & password and enter the Free Fire custom room.'
                : 'Organiser published the room. Join this match to see the Room ID & Password and copy them with one tap.'}
            </p>
          </div>
        )}

        {/* Join button CTA */}
        <button
          type="button"
          disabled={joined || joining || joinClosed || (!identityOk && balance >= match.entryFee) || balance < match.entryFee}
          onClick={() => onJoin({ inGameName: ign.trim(), inGameUid: uid.trim() })}
          className={cx(
            'mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-black shadow-lg transition-all active:scale-[0.96]',
            joined
              ? 'bg-emerald-500 text-white'
              : joinClosed
              ? 'cursor-not-allowed bg-slate-300 text-slate-600'
              : balance >= match.entryFee
              ? 'bg-[#FFD000] text-slate-950 shadow-amber-400/20 hover:bg-[#FFDA29] disabled:opacity-60'
              : 'cursor-not-allowed bg-slate-300 text-slate-600'
          )}
        >
          {joined ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Slot Already Secured
            </>
          ) : joinClosed ? (
            'Entry closed — joining stops 1 min before start'
          ) : joining ? (
            'Booking your slot...'
          ) : balance >= match.entryFee ? (
            'Confirm & Join Slot'
          ) : (
            'Add Cash to Join'
          )}
        </button>
        {!joined && !joinClosed && (
          <p
            className={cx(
              'mt-1.5 flex items-start justify-center gap-1 text-center text-[10px] font-semibold',
              hasCredentials ? 'text-emerald-500' : isDark ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
            {hasCredentials
              ? 'Room ID & Password are published — copy them in this sheet.'
              : 'Custom Room ID & Password join karne ke baad yahin milenge (1-tap copy).'}
          </p>
        )}
        <p className={cx('mt-2 text-center text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
          By joining, you agree to the Arena fair-play rules.
        </p>
      </div>
    </div>
  );
}

/**
 * One compact credential box (Room ID / Password) with a 1-tap copy button —
 * sized like the demo's inner stat strips so two fit side by side on a phone.
 */
function RoomValueRow({
  label,
  value,
  masked,
  copied,
  isDark,
  onCopy,
}: {
  label: string;
  value: string;
  masked: boolean;
  copied: boolean;
  isDark: boolean;
  onCopy: () => void;
}) {
  const disabled = masked || !value;
  return (
    <div
      className={cx(
        'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
        isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-white'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p
          className={cx(
            'truncate text-[13px] font-black leading-tight tracking-wide',
            disabled ? 'text-slate-500' : isDark ? 'text-white' : 'text-slate-950'
          )}
        >
          {masked ? '••••••' : value || '—'}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        aria-label={`Copy ${label}`}
        className={cx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all active:scale-90',
          disabled
            ? isDark
              ? 'border-white/5 text-slate-600'
              : 'border-slate-200 text-slate-300'
            : copied
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500'
            : isDark
            ? 'border-white/15 bg-white/5 text-slate-300 hover:text-white'
            : 'border-slate-300 bg-slate-50 text-slate-600 hover:text-slate-950'
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
