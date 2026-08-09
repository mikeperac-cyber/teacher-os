/**
 * Feature 6 — week capacity strip.
 *
 * Shows lessons booked against slots available, so two opposite problems become
 * visible at a glance: days stacked past what the teacher wants to teach, and
 * days sitting empty that could absorb a makeup lesson.
 *
 * Capacity is a stated preference (`DayCapacity`), not a derived maximum. A day
 * with four lessons is only overbooked if the teacher said three; without that
 * preference there is nothing to compare against and no judgement is made.
 */

import type { DayCapacity, UpcomingLesson } from "@/lib/types/domain";
import type { CapacityDay, WeekCapacity } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";
import { addDays, isoDate, isSameDay, parseIso, startOfWeek } from "./time";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const EMPTY_WEEK: WeekCapacity = {
  days: [],
  totalBooked: 0,
  totalCapacity: 0,
  utilization: 0,
  overbookedDays: [],
  openDays: [],
};

/**
 * Builds the seven-day strip for the week containing `now`.
 *
 * `weekOffset` shifts by whole weeks so the strip can be paged without
 * recomputing anywhere else.
 */
export function buildWeekCapacity(
  lessons: UpcomingLesson[],
  capacities: DayCapacity[],
  track: Track,
  now: Date,
  weekOffset = 0,
): WeekCapacity {
  const weekStart = addDays(startOfWeek(now), weekOffset * 7);

  const capacityByDate = new Map(
    capacities.map((entry) => [entry.date, entry.capacity]),
  );

  const bookedByDate = new Map<string, number>();
  for (const lesson of lessons) {
    if (lesson.track !== track) continue;
    const start = parseIso(lesson.startsAt);
    if (!start) continue;
    const key = isoDate(start);
    bookedByDate.set(key, (bookedByDate.get(key) ?? 0) + 1);
  }

  const days: CapacityDay[] = WEEKDAY_LABELS.map((label, index) => {
    const date = addDays(weekStart, index);
    const key = isoDate(date);
    const booked = bookedByDate.get(key) ?? 0;
    const capacity = capacityByDate.get(key) ?? 0;

    return {
      label,
      date: key,
      booked,
      capacity,
      isToday: isSameDay(date, now),
      overbooked: capacity > 0 && booked > capacity,
      // Only a day the teacher is actually available for counts as an
      // opportunity. A capacity of zero is a day off, not a gap.
      empty: capacity > 0 && booked === 0,
    };
  });

  const totalBooked = days.reduce((sum, day) => sum + day.booked, 0);
  const totalCapacity = days.reduce((sum, day) => sum + day.capacity, 0);

  return {
    days,
    totalBooked,
    totalCapacity,
    utilization:
      totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0,
    overbookedDays: days.filter((day) => day.overbooked),
    openDays: days.filter((day) => day.empty),
  };
}
