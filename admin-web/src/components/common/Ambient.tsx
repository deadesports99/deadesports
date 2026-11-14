import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

/**
 * App-wide ambience — the same quiet navy wash + micro grid the player app uses.
 *
 * The artwork is deliberately faint (8–10%) so tables and money figures stay
 * readable; light mode keeps it neutral instead of tinted.
 */
export function Ambient({ withArtwork = true }: { withArtwork?: boolean }) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {withArtwork && (
        <img
          src="/assets/backgrounds/bg_dark_ai.webp"
          alt=""
          draggable={false}
          className={cx(
            'absolute inset-0 h-full w-full select-none object-cover',
            isDark ? 'opacity-[0.10]' : 'opacity-[0.05]'
          )}
          style={{ filter: isDark ? 'saturate(0.9)' : 'grayscale(1) saturate(0.2)' }}
        />
      )}

      {/* Scrim keeps content readable on top of the artwork */}
      <div
        className={cx(
          'absolute inset-0',
          isDark
            ? 'bg-[linear-gradient(to_bottom,rgba(5,11,20,0.55)_0%,rgba(5,11,20,0.82)_55%,rgba(5,11,20,0.95)_100%)]'
            : 'bg-[linear-gradient(to_bottom,rgba(241,245,249,0.75)_0%,rgba(241,245,249,0.9)_55%,rgba(241,245,249,0.98)_100%)]'
        )}
      />

      {/* Top vignette (no neon orbs — the demo's "clean arena" look) */}
      <div
        className={cx(
          'absolute inset-0',
          isDark
            ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.75),transparent_70%)]'
            : 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.9),transparent_70%)]'
        )}
      />

      {/* Micro grid: 32px, almost invisible */}
      <div
        className={cx(
          'absolute inset-0 bg-[size:32px_32px]',
          isDark
            ? 'bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] opacity-50'
            : 'bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] opacity-40'
        )}
      />
    </div>
  );
}
