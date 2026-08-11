/**
 * Prep checklist, next-lesson selection and week capacity.
 */

import { describe, expect, it } from "vitest";

import { buildWeekCapacity } from "@/lib/dashboard/capacity";
import {
  buildNextUp,
  deriveWorkflowStage,
  selectNextLesson,
} from "@/lib/dashboard/next-lesson";
import { buildPrepChecklist } from "@/lib/dashboard/prep-checklist";
import { NOW, daysFromNow, hoursFromNow, iso, lesson } from "./helpers";

describe("prep checklist", () => {
  it("reports nothing to prepare when no lesson is scheduled", () => {
    const prep = buildPrepChecklist(null, NOW);
    expect(prep.items).toEqual([]);
    expect(prep.ready).toBe(false);
  });

  it("is ready when every blocking requirement is met", () => {
    const prep = buildPrepChecklist(lesson(), NOW);
    expect(prep.blockers).toEqual([]);
    expect(prep.ready).toBe(true);
    expect(prep.readiness).toBe(100);
  });

  it("blocks on unreturned homework", () => {
    const prep = buildPrepChecklist(lesson({ homeworkReturned: false }), NOW);
    expect(prep.blockers.map((b) => b.id)).toContain("homework-returned");
    expect(prep.ready).toBe(false);
  });

  it("blocks on a missing plan and on an unplanned lesson flow", () => {
    const prep = buildPrepChecklist(
      lesson({ hasPlan: false, plannedBlocks: 0 }),
      NOW,
    );
    expect(prep.blockers.map((b) => b.id)).toEqual(["plan", "lesson-flow"]);
  });

  it("treats a stale goal review as advisory, not blocking", () => {
    const prep = buildPrepChecklist(
      lesson({ goalsReviewedAt: iso(daysFromNow(-90)) }),
      NOW,
    );
    const goals = prep.items.find((item) => item.id === "goals");
    expect(goals?.ready).toBe(false);
    expect(goals?.blocking).toBe(false);
    expect(prep.ready).toBe(true);
  });

  it("handles a goal that has never been reviewed", () => {
    const prep = buildPrepChecklist(lesson({ goalsReviewedAt: null }), NOW);
    expect(prep.items.find((i) => i.id === "goals")?.detail).toBe("Never reviewed");
  });

  it("reports readiness as a percentage of all requirements", () => {
    const prep = buildPrepChecklist(
      lesson({ homeworkReturned: false, goalsReviewedAt: null }),
      NOW,
    );
    expect(prep.readiness).toBe(50);
  });
});

describe("next lesson selection", () => {
  it("returns null when nothing is scheduled", () => {
    expect(selectNextLesson([], "ESL", NOW)).toBeNull();
  });

  it("picks the soonest upcoming lesson", () => {
    const soon = lesson({
      id: "soon",
      startsAt: iso(hoursFromNow(1)),
      endsAt: iso(hoursFromNow(2)),
    });
    const later = lesson({
      id: "later",
      startsAt: iso(hoursFromNow(5)),
      endsAt: iso(hoursFromNow(6)),
    });
    expect(selectNextLesson([later, soon], "ESL", NOW)?.id).toBe("soon");
  });

  it("prefers a lesson in progress over the next one", () => {
    const running = lesson({
      id: "running",
      startsAt: iso(hoursFromNow(-0.5)),
      endsAt: iso(hoursFromNow(0.5)),
    });
    const next = lesson({
      id: "next",
      startsAt: iso(hoursFromNow(3)),
      endsAt: iso(hoursFromNow(4)),
    });
    const picked = selectNextLesson([next, running], "ESL", NOW);
    expect(picked?.id).toBe("running");
    expect(buildNextUp(picked, NOW)?.inProgress).toBe(true);
  });

  it("drops lessons that finished well before now", () => {
    const finished = lesson({
      startsAt: iso(hoursFromNow(-3)),
      endsAt: iso(hoursFromNow(-2)),
    });
    expect(selectNextLesson([finished], "ESL", NOW)).toBeNull();
  });

  it("does not return another track's lesson", () => {
    expect(selectNextLesson([lesson({ track: "IELTS" })], "ESL", NOW)).toBeNull();
  });
});

describe("workflow stage", () => {
  it("has no stage without a lesson", () => {
    expect(deriveWorkflowStage(null, NOW)).toBeNull();
  });

  it("sits at Check HW while homework is unreturned", () => {
    expect(deriveWorkflowStage(lesson({ homeworkReturned: false }), NOW)).toBe(2);
  });

  it("moves to Prepare once homework is returned but the plan is incomplete", () => {
    expect(deriveWorkflowStage(lesson({ plannedBlocks: 0 }), NOW)).toBe(3);
  });

  it("reaches Deliver when everything is ready", () => {
    expect(deriveWorkflowStage(lesson(), NOW)).toBe(4);
  });
});

describe("week capacity", () => {
  it("makes no judgement without a stated capacity", () => {
    const week = buildWeekCapacity([lesson()], [], "ESL", NOW);
    expect(week.overbookedDays).toEqual([]);
    expect(week.openDays).toEqual([]);
    expect(week.utilization).toBe(0);
  });

  it("flags a day booked beyond its capacity", () => {
    const today = iso(NOW).slice(0, 10);
    const lessons = [
      lesson({ id: "a", startsAt: iso(hoursFromNow(1)), endsAt: iso(hoursFromNow(2)) }),
      lesson({ id: "b", startsAt: iso(hoursFromNow(3)), endsAt: iso(hoursFromNow(4)) }),
      lesson({ id: "c", startsAt: iso(hoursFromNow(5)), endsAt: iso(hoursFromNow(6)) }),
    ];
    const week = buildWeekCapacity(
      lessons,
      [{ date: today, capacity: 2 }],
      "ESL",
      NOW,
    );
    expect(week.overbookedDays.map((d) => d.date)).toEqual([today]);
  });

  it("treats a zero-capacity day as a day off, not a gap to fill", () => {
    const week = buildWeekCapacity(
      [],
      [{ date: iso(daysFromNow(1)).slice(0, 10), capacity: 0 }],
      "ESL",
      NOW,
    );
    expect(week.openDays).toEqual([]);
  });

  it("surfaces an available day with nothing booked", () => {
    const free = iso(daysFromNow(1)).slice(0, 10);
    const week = buildWeekCapacity([], [{ date: free, capacity: 3 }], "ESL", NOW);
    expect(week.openDays.map((d) => d.date)).toEqual([free]);
  });

  it("always returns seven days, starting on Monday", () => {
    const week = buildWeekCapacity([], [], "ESL", NOW);
    expect(week.days).toHaveLength(7);
    expect(week.days[0].label).toBe("Mon");
  });
});
