/**
 * Feature 2 — prep checklist.
 *
 * A schedule tells the teacher a lesson is coming. A prep checklist tells them
 * why it is not ready. Only the second one prevents the pre-class scramble, so
 * this module reports blockers rather than a list of everything that exists.
 *
 * `blocking` marks a requirement that genuinely degrades the lesson if unmet.
 * Reviewing goals is valuable but a lesson still runs without it; arriving with
 * no plan, or with the student's last homework unmarked, is different in kind.
 */

import type { UpcomingLesson } from "@/lib/types/domain";
import type { PrepItem, PrepStatus } from "@/lib/types/dashboard";
import { calendarDaysSince, parseIso } from "./time";

/** Goal reviews older than this are surfaced as a non-blocking prompt. */
export const GOAL_REVIEW_STALE_DAYS = 30;

/** An empty checklist, used when there is no lesson to prepare. */
export const NO_PREP: PrepStatus = {
  items: [],
  readiness: 0,
  blockers: [],
  ready: false,
};

export function buildPrepChecklist(
  lesson: UpcomingLesson | null,
  now: Date,
): PrepStatus {
  if (!lesson) return NO_PREP;

  const isEsl = lesson.track === "ESL";
  const goalsReviewedAt = parseIso(lesson.goalsReviewedAt);
  const goalReviewAge = goalsReviewedAt
    ? calendarDaysSince(goalsReviewedAt, now)
    : null;
  const goalsFresh =
    goalReviewAge !== null && goalReviewAge <= GOAL_REVIEW_STALE_DAYS;

  const items: PrepItem[] = [
    {
      id: "homework-returned",
      label: "Homework checked and returned",
      detail: lesson.homeworkReturned
        ? "Feedback is with the student"
        : "The student arrives without feedback on their last task",
      ready: lesson.homeworkReturned,
      blocking: true,
      link: { area: "Homework", detail: lesson.studentName },
    },
    {
      id: "plan",
      label: isEsl ? "Lesson plan with a CEFR outcome" : "Lesson plan with a band objective",
      detail: lesson.hasPlan
        ? (lesson.objective ?? "Plan saved")
        : isEsl
          ? "No communicative outcome set for this lesson"
          : "No rubric gap or target band set for this lesson",
      ready: lesson.hasPlan,
      blocking: true,
      link: { area: "Lesson Planner", detail: lesson.studentName },
    },
    {
      id: "lesson-flow",
      label: "Lesson flow prepared",
      detail:
        lesson.plannedBlocks > 0
          ? `${lesson.plannedBlocks} timed activit${lesson.plannedBlocks === 1 ? "y" : "ies"}`
          : "No activities planned — the lesson has no shape to teach to",
      ready: lesson.plannedBlocks > 0,
      blocking: true,
      link: { area: "Lesson Planner", detail: lesson.studentName },
    },
    {
      id: "goals",
      label: "Goals reviewed recently",
      detail: goalsFresh
        ? `Last reviewed ${goalReviewAge} day${goalReviewAge === 1 ? "" : "s"} ago`
        : goalReviewAge === null
          ? "Never reviewed"
          : `Last reviewed ${goalReviewAge} days ago`,
      ready: goalsFresh,
      blocking: false,
      link: { area: "Goals", detail: lesson.studentName },
    },
  ];

  const ready = items.filter((item) => item.ready).length;
  const blockers = items.filter((item) => item.blocking && !item.ready);

  return {
    items,
    readiness: Math.round((ready / items.length) * 100),
    blockers,
    ready: blockers.length === 0,
  };
}
