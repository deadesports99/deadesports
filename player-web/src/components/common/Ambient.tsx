import React from 'react';
import { Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface AmbientProps {
  theme: Theme;
}

export function Ambient({ theme }: AmbientProps) {
  const isDark = theme === 'dark';
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
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
