import React from 'react';
import { Gamepad2, Settings, Wallet } from 'lucide-react';
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
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className={cx(
        'fixed bottom-0 inset-x-0 z-30 border-t px-4 pb-3 pt-2 backdrop-blur-2xl',
        isDark ? 'border-white/10 bg-slate-950/90 shadow-2xl shadow-black' : 'border-slate-900/10 bg-white/90 shadow-xl'
      )}
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="group flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95"
            >
              {/* Native M3 Style Active Indicator Pill (Icon Only) */}
              <div
                className={cx(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200',
                  isActive
                    ? isDark
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'bg-slate-900/10 text-slate-950 border border-slate-900/10'
                    : isDark
                    ? 'bg-transparent text-slate-400 group-hover:text-slate-200'
                    : 'bg-transparent text-slate-500 group-hover:text-slate-800'
                )}
              >
                <Icon
                  className={cx(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'
                  )}
                />
              </div>

              {/* Label below the indicator */}
              <span
                className={cx(
                  'text-[10px] tracking-tight transition-colors duration-200',
                  isActive
                    ? isDark
                      ? 'font-black text-white'
                      : 'font-black text-slate-950'
                    : isDark
                    ? 'font-medium text-slate-400'
                    : 'font-medium text-slate-500'
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
