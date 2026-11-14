import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface CrestProps {
  small?: boolean;
  className?: string;
}

/**
 * Spartan lion crest — the same transparent PNG the player app ships.
 * `small` = 44px header size, default = 56px hero/auth size.
 */
export function Crest({ small = false, className }: CrestProps) {
  const isDark = useTheme() === 'dark';

  return (
    <div
      className={cx(
        'relative flex shrink-0 items-center justify-center',
        small ? 'h-11 w-11' : 'h-14 w-14',
        className
      )}
    >
      <div
        className={cx(
          'absolute -inset-1 rounded-full blur-lg',
          isDark ? 'bg-amber-400/20' : 'bg-amber-400/25'
        )}
        aria-hidden="true"
      />
      <img
        src={
          small
            ? '/assets/logos/spartan_logo_crest_96.png'
            : '/assets/logos/spartan_logo_crest_128.png'
        }
        alt="Spartan Arena"
        width={small ? 44 : 56}
        height={small ? 44 : 56}
        draggable={false}
        className="relative h-full w-full select-none object-contain drop-shadow-[0_4px_12px_rgba(255,140,0,0.35)]"
      />
    </div>
  );
}
