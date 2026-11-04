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
      {/* Glow Orbs */}
      <div
        className={cx(
          'absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full blur-[140px]',
          isDark ? 'bg-sky-500/15' : 'bg-slate-300/30'
        )}
      />
      <div
        className={cx(
          'absolute -bottom-48 -right-48 h-[560px] w-[560px] rounded-full blur-[150px]',
          isDark ? 'bg-amber-500/10' : 'bg-slate-200/40'
        )}
      />

      {/* Grid Pattern */}
      <div
        className={cx(
          'absolute inset-0 bg-[size:36px_36px]',
          isDark
            ? 'bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] opacity-50'
            : 'bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] opacity-40'
        )}
      />
    </div>
  );
}
