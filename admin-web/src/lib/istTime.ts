/**
 * IST (Asia/Kolkata) helpers for the schedule form.
 *
 * The boss rule: every match time is entered and shown in IST with a 12-hour
 * AM/PM picker, whatever the browser's time zone is. `Asia/Kolkata` is a fixed
 * +05:30 offset (no DST), so we can build an ISO string with an explicit offset
 * and the backend stores the exact instant.
 */

const IST_OFFSET_MINUTES = 330;

export type Meridiem = 'AM' | 'PM';

export interface IstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** A form-friendly schedule in IST. */
export interface ScheduleDraft {
  /** `YYYY-MM-DD` (IST calendar day). */
  date: string;
  /** 1..12 */
  hour12: number;
  /** 0..59 */
  minute: number;
  meridiem: Meridiem;
}

export const pad2 = (value: number): string => String(Math.trunc(value)).padStart(2, '0');

/** Wall-clock parts of an instant, read in IST. */
export function istPartsOf(date: Date = new Date()): IstParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function dateInputValue(parts: Pick<IstParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function to24Hour(hour12: number, meridiem: Meridiem): number {
  const hour = Math.min(12, Math.max(1, Math.round(hour12)));
  if (meridiem === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

export function to12Hour(hour24: number): { hour12: number; meridiem: Meridiem } {
  const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, meridiem };
}

/** IST form draft → the ISO instant the API expects. */
export function scheduleToIso(draft: ScheduleDraft): string {
  const hour24 = to24Hour(draft.hour12, draft.meridiem);
  return new Date(
    `${draft.date}T${pad2(hour24)}:${pad2(Math.round(draft.minute))}:00+05:30`
  ).toISOString();
}

/** ISO instant → IST form draft. */
export function isoToSchedule(iso: string | Date): ScheduleDraft {
  const parts = istPartsOf(new Date(iso));
  const { hour12, meridiem } = to12Hour(parts.hour);
  return {
    date: dateInputValue(parts),
    hour12,
    minute: parts.minute,
    meridiem,
  };
}

/** Round an instant up to the next quarter hour (the "+1h / +3h" chips). */
export function roundUpToQuarter(date: Date): Date {
  const step = 15 * 60_000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

/** Default kickoff: two hours from now, on the next quarter hour. */
export function defaultSchedule(): ScheduleDraft {
  const target = roundUpToQuarter(new Date(Date.now() + 2 * 60 * 60_000));
  return isoToSchedule(target);
}

/** Shift a draft by whole hours (quick chips) and return the new draft. */
export function shiftSchedule(draft: ScheduleDraft, hours: number): ScheduleDraft {
  return isoToSchedule(new Date(new Date(scheduleToIso(draft)).getTime() + hours * 3_600_000));
}

/** `05 Nov 2026, 08:00 PM IST` from a draft — same format as formatIST(). */
export function draftPreview(draft: ScheduleDraft): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(scheduleToIso(draft)));
}

/** True when the draft is at least 60s in the future (backend requirement). */
export function isDraftInFuture(draft: ScheduleDraft): boolean {
  return new Date(scheduleToIso(draft)).getTime() > Date.now() + 60_000;
}

/** Draft + N hours (used for clone defaults: +1h, +1 day). */
export function draftFromIsoPlus(iso: string, hours: number): ScheduleDraft {
  return isoToSchedule(new Date(new Date(iso).getTime() + hours * 3_600_000));
}
