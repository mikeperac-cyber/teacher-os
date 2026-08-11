/**
 * Feature 1 — next-up lesson.
 *
 * Resolves the single lesson the teacher should be thinking about, and gathers
 * the four things they otherwise hunt for in the minutes before class: the
 * plan, the materials, the last post-class notes, and the way in.
 *
 * A lesson already under way outranks one that has not started — during a class
 * the teacher needs the room, not the next appointment.
 */

import type { UpcomingLesson } from "@/lib/types/domain";
import type { NextUpLesson } from "@/lib/types/dashboard";
import { buildPrepChecklist } from "./prep-checklist";
import { minutesBetween, parseIso, timeRange } from "./time";

/** A lesson stays "next up" for this long after it was due to end. */
export const RECENTLY_ENDED_GRACE_MINUTES = 10;

/**
 * Picks the current or next lesson for a track.
 *
 * Returns null when nothing is scheduled, which is the correct state for an
 * empty workspace and drives the panel's empty state.
 */
export function selectNextLesson(
  lessons: UpcomingLesson[],
  track: string,
  now: Date,
): UpcomingLesson | null {
  const candidates = lessons
    .filter((lesson) => lesson.track === track)
    .map((lesson) => ({
      lesson,
      start: parseIso(lesson.startsAt),
      end: parseIso(lesson.endsAt),
    }))
    .filter(
      (entry): entry is { lesson: UpcomingLesson; start: Date; end: Date } =>
        entry.start !== null && entry.end !== null,
    )
    // Drop lessons that finished more than the grace period ago.
    .filter(
      (entry) => minutesBetween(now, entry.end) > -RECENTLY_ENDED_GRACE_MINUTES,
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return candidates[0]?.lesson ?? null;
}

/**
 * Which of the nine workflow stages the next lesson has reached.
 *
 * Derived from what is actually true about the lesson rather than stored, so
 * the lifecycle strip cannot drift out of sync with the prep checklist beside
 * it. Returns null when nothing is scheduled — there is no stage to be at.
 *
 * Stage indices follow `lib/navigation/workflow.ts`:
 * 0 Upcoming · 1 HW status · 2 Check HW · 3 Prepare · 4 Deliver …
 */
export function deriveWorkflowStage(
  lesson: UpcomingLesson | null,
  now: Date,
): number | null {
  if (!lesson) return null;

  const start = parseIso(lesson.startsAt);
  const end = parseIso(lesson.endsAt);
  if (start && end && minutesBetween(now, start) <= 0 && minutesBetween(now, end) > 0) {
    return 4; // Deliver
  }
  if (!lesson.homeworkReturned) return 2; // Check HW
  if (!lesson.hasPlan || lesson.plannedBlocks === 0) return 3; // Prepare
  return 4; // Ready to deliver
}

/** Builds the panel view model, including readiness from the prep checklist. */
export function buildNextUp(
  lesson: UpcomingLesson | null,
  now: Date,
): NextUpLesson | null {
  if (!lesson) return null;

  const start = parseIso(lesson.startsAt);
  const end = parseIso(lesson.endsAt);
  if (!start || !end) return null;

  const minutesUntil = minutesBetween(now, start);
  const prep = buildPrepChecklist(lesson, now);

  return {
    lessonId: lesson.id,
    studentName: lesson.studentName,
    studentInitials: lesson.studentInitials,
    tone: lesson.tone,
    courseLabel: lesson.courseLabel,
    startsAt: lesson.startsAt,
    timeLabel: timeRange(start, end),
    minutesUntil,
    inProgress: minutesUntil <= 0 && minutesBetween(now, end) > 0,
    objective: lesson.objective,
    readiness: prep.readiness,
    hasPlan: lesson.hasPlan,
    plannedBlocks: lesson.plannedBlocks,
    lastNotes: lesson.lastNotes,
    links: {
      plan: { area: "Lesson Planner", detail: lesson.studentName },
      materials: { area: "Materials", detail: lesson.studentName },
      lastNotes: { area: "Lessons", detail: lesson.studentName },
      student: { area: "Students", detail: lesson.studentName },
    },
  };
}
