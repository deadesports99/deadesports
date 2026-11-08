import React from 'react';
import { cx } from '../../utils/formatters';

interface CrestProps {
  small?: boolean;
  className?: string;
}

/**
 * App brand mark — the Spartan lion crest.
 *
 * Renders the transparent PNG logo (`/assets/logos/`) so the artwork stays sharp
 * at every size. `small` is the header size (44px), the default is the larger
 * 56px mark used on hero / auth surfaces.
 */
export function Crest({ small = false, className }: CrestProps) {
  return (
    <div
      className={cx(
        'relative flex shrink-0 items-center justify-center',
        small ? 'h-11 w-11' : 'h-14 w-14',
        className
      )}
    >
      <div className="absolute -inset-1 rounded-full bg-amber-400/20 blur-lg" aria-hidden="true" />
      <img
        src={small ? '/assets/logos/spartan_logo_crest_96.png' : '/assets/logos/spartan_logo_crest_128.png'}
        alt="Spartan Arena"
        width={small ? 44 : 56}
        height={small ? 44 : 56}
        draggable={false}
        className="relative h-full w-full select-none object-contain drop-shadow-[0_4px_12px_rgba(255,140,0,0.35)]"
      />
    </div>
  );
}
