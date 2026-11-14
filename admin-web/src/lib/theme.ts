import { useSyncExternalStore } from 'react';
import type { Theme } from '../types';

/**
 * Theme preference — same dark/light pair the player app ships, so a laptop
 * sitting next to a staff phone does not look like two different products.
 *
 * Default is dark (the esports look), persisted in localStorage.
 */
const KEY = 'spartan.admin.theme.v1';

function read(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let theme: Theme = read();
const listeners = new Set<() => void>();

function apply(next: Theme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    root.classList.toggle('light', next === 'light');
    root.style.colorScheme = next;
    document.body.style.backgroundColor = next === 'dark' ? '#050b14' : '#f1f5f9';
  }
}

apply(theme);

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme) {
  if (next === theme) return;
  theme = next;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the theme just resets next load */
  }
  listeners.forEach((listener) => listener());
}

export function toggleTheme() {
  setTheme(theme === 'dark' ? 'light' : 'dark');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}
