import React from 'react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';
import { backgroundOption, useBackground } from '../../lib/background';

interface AmbientProps {
  theme: Theme;
}

export function Ambient({ theme }: AmbientProps) {
  const isDark = theme === 'dark';
  const bg = useBackground();
  const option = backgroundOption(bg.id);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Background image — Settings > Background se select hoti hai */}
      {option.src && (
        <img
          src={option.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{
            opacity: bg.opacity / 100,
            filter: isDark ? 'saturate(0.95)' : 'saturate(0.9) contrast(0.97)',
          }}
        />
      )}

      {/* Bottom scrim — text/cards ke peeche thoda solid */}
      {option.src && (
        <div
          className={cx(
            'absolute inset-0',
            isDark
              ? 'bg-[linear-gradient(to_bottom,rgba(5,11,20,0.35)_0%,rgba(5,11,20,0.05)_45%,rgba(5,11,20,0.55)_100%)]'
              : 'bg-[linear-gradient(to_bottom,rgba(248,250,252,0.4)_0%,rgba(248,250,252,0.1)_45%,rgba(248,250,252,0.6)_100%)]'
          )}
        />
      )}

      {/* Subtle clean neutral vignette - No artificial neon orbs */}
      <div
        className={cx(
          'absolute inset-0',
          isDark
            ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.6),transparent_70%)]'
            : 'bg-[radial-gradient(circle_at_50%_0%,rgba(241,245,249,0.8),transparent_70%)]'
        )}
      />

      {/* Subtle micro grid */}
      <div
        className={cx(
          'absolute inset-0 bg-[size:32px_32px]',
          isDark
            ? 'bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] opacity-40'
            : 'bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] opacity-30'
        )}
      />
    </div>
  );
}
