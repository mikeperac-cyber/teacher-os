/**
 * Time helpers for dashboard triage.
 *
 * Every function takes `now` explicitly. Two reasons:
 *
 * 1. **Testability.** "Overdue by 2 days" is a claim that must be verifiable
 *    without waiting two days.
 * 2. **Hydration.** These values are rendered. If the server computed
 *    "in 48 min" from its own clock and the client recomputed it a moment
 *    later, React would report a hydration mismatch. Passing a single `now`
 *    down from one place keeps both renders identical.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Parses an ISO timestamp, returning null rather than an Invalid Date. */
export function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MINUTE_MS);
}

/** Whole days between two instants. Negative when `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Calendar days elapsed, ignoring clock time. */
export function calendarDaysSince(since: Date, now: Date): number {
  const a = Date.UTC(since.getFullYear(), since.getMonth(), since.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / DAY_MS);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Zero-padded 24-hour clock, e.g. "19:00". */
export function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Rendered range for a lesson, e.g. "19:00–20:00". */
export function timeRange(start: Date, end: Date): string {
  return `${clock(start)}–${clock(end)}`;
}

/**
 * Human due label, e.g. "Overdue by 2 days", "Due in 48 min", "Tomorrow".
 * Returns "No due date" when nothing is scheduled — never a fabricated one.
 */
export function dueLabel(dueAt: string | null, now: Date): string {
  const due = parseIso(dueAt);
  if (!due) return "No due date";

  const minutes = minutesBetween(now, due);

  if (minutes < 0) {
    const overdueMinutes = Math.abs(minutes);
    if (overdueMinutes < 60) return `Overdue by ${overdueMinutes} min`;
    if (overdueMinutes < 24 * 60) {
      return `Overdue by ${Math.floor(overdueMinutes / 60)}h`;
    }
    const days = Math.floor(overdueMinutes / (24 * 60));
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }

  if (minutes < 60) return `Due in ${minutes} min`;
  if (isSameDay(due, now)) return `Today · ${clock(due)}`;

  const days = calendarDaysSince(now, due);
  if (days === 1) return `Tomorrow · ${clock(due)}`;
  if (days < 7) return `In ${days} days`;
  return `In ${Math.floor(days / 7)} week${days < 14 ? "" : "s"}`;
}

/** Countdown for the next lesson, e.g. "In 48 min", "In 2h 15m", "Now". */
export function countdownLabel(minutesUntil: number): string {
  if (minutesUntil <= 0) return "Now";
  if (minutesUntil < 60) return `In ${minutesUntil} min`;
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  if (hours < 24) return minutes ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
  const days = Math.floor(hours / 24);
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

/** Monday of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday. Shift so Monday is the first column.
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** ISO calendar date (YYYY-MM-DD) in local time, for keying by day. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
