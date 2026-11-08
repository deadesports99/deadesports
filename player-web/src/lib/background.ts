import { useSyncExternalStore } from 'react';

/**
 * Background image preference — shared by the whole app.
 *
 * Demo ke liye banaya gaya hai: Settings > Background se image aur uski opacity
 * live change ho sakti hai, choice localStorage me yaad rehti hai.
 */
export type BgTheme = 'dark' | 'light';

export interface BgOption {
  id: string;
  label: string;
  src: string | null;
  theme: BgTheme;
}

export const BG_OPTIONS: BgOption[] = [
  { id: 'none', label: 'None', src: null, theme: 'dark' },
  { id: 'arena', label: 'Arena', src: '/assets/backgrounds/bg_dark_ai.webp', theme: 'dark' },
  { id: 'warrior', label: 'Warrior', src: '/assets/backgrounds/bg_dark_warrior.webp', theme: 'dark' },
  { id: 'samurai', label: 'Samurai', src: '/assets/backgrounds/bg_dark_samurai.webp', theme: 'dark' },
  { id: 'katana', label: 'Katana', src: '/assets/backgrounds/bg_dark_katana.webp', theme: 'dark' },
  { id: 'neon', label: 'Neon', src: '/assets/backgrounds/bg_dark_neon.webp', theme: 'dark' },
  { id: 'paper', label: 'Paper', src: '/assets/backgrounds/bg_light_geometry.webp', theme: 'light' },
];

export interface BgState {
  id: string;
  opacity: number; // 10 - 50 (%)
}

const KEY = 'spartan.bg.v1';
const DEFAULT_STATE: BgState = { id: 'arena', opacity: 18 };

function read(): BgState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<BgState>;
    const id = BG_OPTIONS.some((o) => o.id === parsed.id) ? (parsed.id as string) : DEFAULT_STATE.id;
    const opacity =
      typeof parsed.opacity === 'number' && parsed.opacity >= 10 && parsed.opacity <= 50
        ? Math.round(parsed.opacity)
        : DEFAULT_STATE.opacity;
    return { id, opacity };
  } catch {
    return DEFAULT_STATE;
  }
}

let state: BgState = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setBackground(patch: Partial<BgState>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode — the choice just won't survive a reload */
  }
  emit();
}

export function getBackground(): BgState {
  return state;
}

export function backgroundOption(id: string): BgOption {
  return BG_OPTIONS.find((o) => o.id === id) ?? BG_OPTIONS[0];
}

/** React hook — re-renders whenever the picker in Settings changes. */
export function useBackground(): BgState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getBackground,
    getBackground
  );
}
