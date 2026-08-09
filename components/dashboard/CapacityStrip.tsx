"use client";

/**
 * Feature 6 — week capacity strip.
 *
 * Compact by design. Two problems must be readable in about a second:
 * days stacked past what the teacher wants to teach, and days sitting empty
 * that could absorb a makeup lesson.
 *
 * The full week grid lives in Calendar; this is the signal, not the schedule.
 */

import { AlertTriangle, ArrowRight, CalendarDays } from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import type { DeepLink, WeekCapacity } from "@/lib/types/dashboard";

export function CapacityStrip({
  week,
  navigate,
}: {
  week: WeekCapacity;
  navigate: (link: DeepLink) => void;
}) {
  const hasCapacityPreference = week.totalCapacity > 0;
  const hasBookings = week.totalBooked > 0;

  return (
    <article className="panel capacity-strip-panel">
      <PanelHeader
        kicker="This week"
        title="Teaching capacity"
        action={
          hasCapacityPreference ? (
            <span className="muted-count">{week.utilization}% booked</span>
          ) : undefined
        }
      />

      {!hasBookings && !hasCapacityPreference ? (
        <EmptyState
          icon={CalendarDays}
          title="No lessons or availability"
          hint="Set how many lessons you want per day to see overbooking and free slots."
        />
      ) : (
        <>
          <div className="capacity-days">
            {week.days.map((day) => {
              const fill = day.capacity
                ? Math.min(100, Math.round((day.booked / day.capacity) * 100))
                : 0;
              return (
                <button
                  key={day.date}
                  className={`capacity-day ${day.isToday ? "is-today" : ""} ${day.overbooked ? "is-over" : ""} ${day.empty ? "is-open" : ""}`}
                  onClick={() => navigate({ area: "Calendar", detail: day.date })}
                  title={
                    day.capacity
                      ? `${day.booked} of ${day.capacity} slots`
                      : `${day.booked} lesson${day.booked === 1 ? "" : "s"}`
                  }
                >
                  <span className="capacity-label">{day.label}</span>
                  <span className="capacity-meter">
                    <i style={{ height: `${fill}%` }} />
                  </span>
                  <b>{day.booked}</b>
                </button>
              );
            })}
          </div>

          <div className="capacity-summary">
            {week.overbookedDays.length > 0 && (
              <button
                className="capacity-flag is-over"
                onClick={() => navigate({ area: "Calendar" })}
              >
                <AlertTriangle size={13} />
                {week.overbookedDays.length} day
                {week.overbookedDays.length === 1 ? "" : "s"} overbooked
              </button>
            )}
            {week.openDays.length > 0 && (
              <button
                className="capacity-flag is-open"
                onClick={() => navigate({ area: "Calendar" })}
              >
                <CalendarDays size={13} />
                {week.openDays.length} free day
                {week.openDays.length === 1 ? "" : "s"} for makeups
              </button>
            )}
            {!week.overbookedDays.length && !week.openDays.length && (
              <span className="capacity-flag is-balanced">
                Balanced week
                <ArrowRight size={12} />
              </span>
            )}
          </div>
        </>
      )}
    </article>
  );
}
