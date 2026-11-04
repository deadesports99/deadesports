import React from 'react';
import { Gamepad2, User, Wallet } from 'lucide-react';
import { NavTab, Theme } from '../../types';
import { cx } from '../../utils/formatters';

interface BottomNavProps {
  theme: Theme;
  activeTab: NavTab;
  onChange: (tab: NavTab) => void;
}

export function BottomNav({ theme, activeTab, onChange }: BottomNavProps) {
  const isDark = theme === 'dark';
  const tabs: Array<{ id: NavTab; label: string; icon: React.ElementType }> = [
    { id: 'tournaments', label: 'Tournaments', icon: Gamepad2 },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className={cx(
        'fixed bottom-0 inset-x-0 z-30 border-t px-4 pb-3 pt-2 backdrop-blur-2xl',
        isDark ? 'border-white/10 bg-slate-950/90 shadow-2xl shadow-black' : 'border-slate-900/10 bg-white/90 shadow-xl'
      )}
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cx(
              'relative flex flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-bold transition-all active:scale-95',
              activeTab === id
                ? isDark
                  ? 'text-[#FFD000]'
                  : 'text-slate-950 font-black'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Icon className={cx('h-5 w-5 shrink-0 transition-transform', activeTab === id && 'scale-110')} />
            <span>{label}</span>
            {activeTab === id && (
              <span className="absolute bottom-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-[#FFD000] shadow-[0_0_8px_#FFD000]" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
