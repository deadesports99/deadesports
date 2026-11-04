import React from 'react';
import { cx } from '../../utils/formatters';

interface CrestProps {
  small?: boolean;
}

export function Crest({ small = false }: CrestProps) {
  return (
    <div className={cx('relative flex shrink-0 items-center justify-center', small ? 'h-9 w-9' : 'h-14 w-14')}>
      <div className="absolute -inset-1 rounded-full bg-sky-400/20 blur-lg" />
      <svg viewBox="0 0 64 68" fill="none" className="relative h-full w-full drop-shadow-[0_4px_12px_rgba(0,194,255,0.3)]">
        <path d="M32 3L57 13.5V33.5C57 49.5 46.2 60.8 32 65C17.8 60.8 7 49.5 7 33.5V13.5L32 3Z" fill="#0B192E" stroke="#38BDF8" strokeWidth="2.5" />
        <path d="M32 14C25.5 14 21 18.8 21 25.5V33L26.5 36.5L28.5 30.5H35.5L37.5 36.5L43 33V25.5C43 18.8 38.5 14 32 14Z" fill="#E2E8F0" />
        <path d="M24.5 25.5L30 27.5L29 29.5L24 27.5Z" fill="#00D2FF" />
        <path d="M39.5 25.5L34 27.5L35 29.5L40 27.5Z" fill="#00D2FF" />
        <rect x="10" y="39" width="44" height="12" rx="2.5" fill="#091326" stroke="#FFD000" strokeWidth="1.5" />
        <text x="32" y="47.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="900" letterSpacing="0.06em">EGA</text>
      </svg>
    </div>
  );
}
