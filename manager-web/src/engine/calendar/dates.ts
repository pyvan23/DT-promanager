// Date helpers on ISO yyyy-mm-dd strings (UTC, no time zones involved).

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return toDate(iso).getUTCDay();
}

/** First date on or after `iso` that falls on one of `days`. */
export function nextWeekday(iso: string, days: number[]): string {
  let d = iso;
  for (let i = 0; i < 7; i++, d = addDays(d, 1)) if (days.includes(weekday(d))) return d;
  return iso;
}

/** Spreads `count` match slots evenly over [from, to], snapped to the given weekdays. */
export function spreadSlots(from: string, to: string, count: number, days: number[]): string[] {
  if (count <= 0) return [];
  const span = Math.max(0, daysBetween(from, to));
  const step = count > 1 ? span / (count - 1) : 0;
  const slots: string[] = [];
  let last = '';
  for (let i = 0; i < count; i++) {
    let d = nextWeekday(addDays(from, Math.round(i * step)), days);
    // Never two slots on the same day: push to the next allowed day.
    while (last && d <= last) d = nextWeekday(addDays(d, 1), days);
    slots.push(d);
    last = d;
  }
  return slots;
}

export const WEEKEND = [0, 6]; // Sunday, Saturday
export const MIDWEEK = [2, 3, 4]; // Tuesday-Thursday
