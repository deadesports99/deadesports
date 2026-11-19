import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface ScrollRegionProps {
  children: ReactNode;
  /** Minimum table width before horizontal scrolling starts. */
  className?: string;
}

/**
 * Horizontal scroll wrapper for dense tables.
 *
 * On phones a 640px-wide ledger does not fit a 390px screen, so the table
 * scrolls sideways. This adds a fade + hint at the right edge to make that
 * discoverable, and hides the affordance once the user has scrolled to the end.
 */
export function ScrollRegion({ children, className }: ScrollRegionProps) {
  const isDark = useTheme() === 'dark';
  const ref = useRef<HTMLDivElement | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  /** Measure on mount so the fade only appears when the table actually overflows. */
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (!el) return;
    setScrollable(el.scrollWidth > el.clientWidth + 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  return (
    <div className="relative">
      <div
        ref={measureRef}
        onScroll={onScroll}
        className={cx('overflow-x-auto', className)}
      >
        {children}
      </div>

      {scrollable && !atEnd && (
        <>
          <div
            aria-hidden="true"
            className={cx(
              'pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-xl',
              isDark ? 'bg-gradient-to-l from-[#0C121E] to-transparent' : 'bg-gradient-to-l from-white to-transparent'
            )}
          />
          <p
            className={cx(
              'pointer-events-none absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
              isDark ? 'bg-white/[0.06] text-slate-600 dark:text-slate-400' : 'bg-slate-900/[0.06] text-slate-600'
            )}
          >
            Scroll →
          </p>
        </>
      )}
    </div>
  );
}
