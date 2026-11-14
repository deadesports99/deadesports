import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class joiner (`compact('px-2', condition && 'px-3')`). */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** ₹1,20,000 — Indian grouping, no decimals unless asked. */
export function formatINR(amount: number, decimals = 0): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₹${Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** 120000 → ₹1.2L (KPI tiles where width matters). */
export function formatINRCompact(amount: number): string {
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatINR(amount);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

const IST = 'Asia/Kolkata';

/** `05 Nov 2026` — always IST, whatever the device timezone is. */
export function formatISTDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** `08:00 PM` — 12-hour IST, the format the boss asked for. */
export function formatISTTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

/** `05 Nov 2026, 08:00 PM IST` — the canonical timestamp in the console. */
export function formatIST(value: string | Date): string {
  return `${formatISTDate(value)}, ${formatISTTime(value)} IST`;
}

/** `Fri, 05 Nov` — dense table cells. */
export function formatISTShort(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

/** Live clock text for the top bar. */
export function istClock(date: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
  return `${time} IST`;
}

/** Long greeting date: `Friday, 05 November 2026`. */
export function formatISTLong(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

/** `starts in 2h 15m` / `started 12m ago` — relative to now. */
export function relativeToNow(value: string | Date): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const past = diffMs < 0;
  const totalMinutes = Math.round(Math.abs(diffMs) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  if (!parts.length) parts.push('moments');

  return past ? `started ${parts.join(' ')} ago` : `starts in ${parts.join(' ')}`;
}

/** `2h 15m` countdown, clamp at zero. */
export function formatCountdown(value: string | Date): string {
  const diffMs = new Date(value).getTime() - Date.now();
  if (diffMs <= 0) return 'now';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

/** Today's date key in IST (`2026-11-05`) — used for "aaj" comparisons. */
export function istDateKey(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function isTodayIST(value: string | Date): boolean {
  return istDateKey(value) === istDateKey(new Date());
}

/** Up to two letters for the avatar chip. */
export function initialsOf(name: string | null | undefined, fallback = 'AD'): string {
  const clean = (name ?? '').trim();
  if (!clean) return fallback;
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || fallback;
}

/** `BERMUDA` → `Bermuda`, `ROOM_REVEALED` → `Room revealed`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Mask a phone number for staff-list style surfaces. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
