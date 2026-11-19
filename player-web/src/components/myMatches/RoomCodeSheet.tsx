import React, { useState } from 'react';
import { Copy, Lock, X } from 'lucide-react';
import { MyMatch, Theme } from '../../types';
import { cx } from '../../utils/formatters';
import { formatKickoffStamp } from '../../lib/mappers';

interface RoomCodeSheetProps {
  theme: Theme;
  match: MyMatch;
  onClose: () => void;
  onCopied: (label: string) => void;
}

/** Room ID & Password for one of my joined matches (published rooms only). */
export function RoomCodeSheet({ theme, match, onClose, onCopied }: RoomCodeSheetProps) {
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState<string | null>(null);
  const roomId = match.room?.roomId ?? '';
  const password = match.room?.roomPassword ?? '';

  const copy = (label: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText?.(value);
    setCopied(label);
    onCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const rows = [
    { label: 'Room ID', value: roomId },
    { label: 'Password', value: password },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-sm">
      <div
        className={cx(
          'mx-auto w-full max-w-lg rounded-t-[28px] border-t p-4 pb-6 shadow-2xl',
          isDark ? 'border-white/10 bg-[#081120]' : 'border-slate-200 bg-white'
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Custom Room
            </p>
            <h3 className={cx('truncate text-sm font-black', isDark ? 'text-white' : 'text-slate-950')}>
              {match.title}
            </h3>
            <p className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {formatKickoffStamp(match.kickoffIso)} · Slot {String(match.slotNumber).padStart(2, '0')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close room details"
            className={cx(
              'rounded-full p-1.5',
              isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cx(
            'rounded-xl border p-3',
            isDark ? 'border-white/10 bg-[#0B1526]' : 'border-slate-200 bg-slate-50'
          )}
        >
          {rows.map(({ label, value }, index) => (
            <div
              key={label}
              className={cx(
                'flex items-center justify-between gap-3 py-2',
                index === 0 && 'pb-2.5',
                index === 1 && 'border-t pt-2.5',
                isDark ? 'border-white/10' : 'border-slate-200'
              )}
            >
              <div className="min-w-0">
                <span className={cx('block text-[9px] font-bold uppercase', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {label}
                </span>
                <span className={cx('font-mono text-[13px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
                  {value || '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copy(label, value)}
                disabled={!value}
                className={cx(
                  'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all active:scale-95',
                  value
                    ? 'bg-[#FFD000] text-slate-950'
                    : isDark
                    ? 'bg-white/5 text-slate-500'
                    : 'bg-slate-200 text-slate-500'
                )}
              >
                <Copy className="h-3 w-3" />
                {copied === label ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <p className={cx('mt-2 flex items-start gap-1.5 text-[10px] leading-snug', isDark ? 'text-slate-400' : 'text-slate-500')}>
          <Lock className="mt-px h-3 w-3 shrink-0" />
          Published by the organiser. Enter this room in Free Fire before the match starts.
        </p>
      </div>
    </div>
  );
}
