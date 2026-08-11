/**
 * Database rows → domain objects.
 *
 * Pure functions, deliberately separate from `triage.ts`, which is
 * `server-only` and cannot be imported by a test. Everything here can be
 * exercised directly, which matters because this is the layer that was
 * silently wrong.
 *
 * THE EMBEDDED-SHAPE TRAP
 * -----------------------
 * PostgREST returns an embedded resource as an **array** normally, but as a
 * single **object** when it can prove the relationship is one-to-one — which it
 * does from a unique constraint on the foreign key. Three of ours qualify:
 *
 *   lesson_plans            unique (lesson_id)
 *   homework_feedback       unique (submission_id)
 *   ielts_student_profiles  unique (student_id)
 *
 * Indexing `[0]` into those yields `undefined`, and the failure is silent: no
 * error, just a lesson that appears to have no plan and a submission that
 * appears to have no feedback. The second is worse than it sounds — the action
 * inbox filters on `feedback.length === 0`, and `undefined === 0` is false, so
 * every pending submission would be dropped and the inbox would always look
 * empty.
 *
 * `firstOf` accepts either shape so the mapping does not depend on a PostgREST
 * inference that can change with a constraint.
 */

import type {
  DayCapacity,
  PendingHomework,
  ScheduledGoalReview,
  ScheduledTask,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";
import type { Priority } from "@/lib/types/domain";
import { toTrackLabel } from "@/lib/types/database";
import type { Track as DbTrack } from "@/lib/types/database";

import { initialsFrom, toneFor } from "./shared";

/**
 * The first embedded record, whichever shape PostgREST used.
 *
 * Handles: a single object, an array of any length, null and undefined.
 */
export function firstOf<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

/** True when an embedded to-many relationship contains nothing. */
export function isEmptyEmbed(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const PRIORITY_LABEL: Record<string, Priority> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const UNKNOWN_LEARNER = "Unknown learner";

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

export type LessonQueryRow = {
  id: string;
  student_id: string;
  track: DbTrack;
  starts_at: string;
  ends_at: string;
  students?: unknown;
  lesson_plans?: unknown;
};

export function mapLesson(row: LessonQueryRow): UpcomingLesson {
  const student = firstOf<{ full_name: string }>(row.students);
  const plan = firstOf<{ objective: string | null; blocks: unknown }>(
    row.lesson_plans,
  );
  const name = student?.full_name ?? UNKNOWN_LEARNER;
  const blocks = Array.isArray(plan?.blocks) ? plan.blocks : [];
  const track = toTrackLabel(row.track);

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: name,
    studentInitials: initialsFrom(name),
    tone: toneFor(row.student_id),
    track,
    courseLabel: track === "ESL" ? "ESL" : "IELTS Academic",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    objective: plan?.objective ?? null,
    hasPlan: plan !== null,
    plannedBlocks: blocks.length,
    // Both are filled in by getTriageData once the related rows are known.
    homeworkReturned: true,
    goalsReviewedAt: null,
    lastNotes: null,
  };
}

/* ------------------------------------------------------------------ */
/* Homework awaiting the teacher                                       */
/* ------------------------------------------------------------------ */

export type SubmissionQueryRow = {
  id: string;
  student_id: string;
  status: string;
  body?: string | null;
  students?: unknown;
  homework_assignments?: unknown;
  homework_feedback?: unknown;
};

/**
 * Whether this submission still needs the teacher.
 *
 * Feedback that exists but has not been released still counts as outstanding —
 * a half-written note is not a returned piece of work.
 */
export function needsTeacher(row: SubmissionQueryRow): boolean {
  const feedback = firstOf<{ released_at: string | null }>(
    row.homework_feedback,
  );
  if (!feedback) return true;
  return feedback.released_at === null;
}

export function mapSubmission(row: SubmissionQueryRow): PendingHomework {
  const assignment = firstOf<{
    title: string;
    track: DbTrack;
    due_at: string | null;
    estimated_minutes: number | null;
    blocks_lesson_id: string | null;
  }>(row.homework_assignments);
  const student = firstOf<{ full_name: string }>(row.students);
  const name = student?.full_name ?? UNKNOWN_LEARNER;

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: name,
    studentInitials: initialsFrom(name),
    tone: toneFor(row.student_id),
    track: toTrackLabel(assignment?.track ?? "esl"),
    task: assignment?.title ?? "Homework",
    body: row.body ?? "",
    dueAt: assignment?.due_at ?? null,
    blocksLessonId: assignment?.blocks_lesson_id ?? null,
    minutes: assignment?.estimated_minutes ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Student signals                                                     */
/* ------------------------------------------------------------------ */

export type StudentQueryRow = {
  id: string;
  full_name: string;
  track: DbTrack;
  ielts_student_profiles?: unknown;
  student_accounts?: unknown;
  last_active_at?: string | null;
  missed_homework?: number | null;
  last_progress_at?: string | null;
};

export function mapStudentSignal(row: StudentQueryRow): StudentSignal {
  const ielts = firstOf<{
    target_band: number | null;
    test_date: string | null;
  }>(row.ielts_student_profiles);

  return {
    studentId: row.id,
    name: row.full_name,
    initials: initialsFrom(row.full_name),
    tone: toneFor(row.id),
    track: toTrackLabel(row.track),
    lastActiveAt: row.last_active_at ?? null,
    missedHomework: row.missed_homework ?? 0,
    lastProgressAt: row.last_progress_at ?? null,
    // `student_accounts` is one-to-one (unique on student_id), so PostgREST
    // returns an object rather than an array — the shape trap from the top of
    // this file, which is why this goes through `firstOf` too.
    hasLogin: firstOf<{ user_id: string }>(row.student_accounts) !== null,
    // `undefined` rather than null: the at-risk rules use `!== undefined` to
    // decide whether a target band is known at all.
    targetBand: ielts?.target_band ?? undefined,
    testDate: ielts?.test_date ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Shared operational records                                          */
/* ------------------------------------------------------------------ */

export type TaskQueryRow = {
  id: string;
  title: string;
  detail: string | null;
  priority: string;
  due_at: string | null;
  estimated_minutes: number | null;
  track: DbTrack | null;
};

export function mapTask(row: TaskQueryRow): ScheduledTask {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail ?? "",
    dueAt: row.due_at,
    priority: PRIORITY_LABEL[row.priority] ?? "Medium",
    minutes: row.estimated_minutes,
    track: row.track ? toTrackLabel(row.track) : null,
    tone: toneFor(row.id),
  };
}

export type GoalQueryRow = {
  id: string;
  title: string;
  progress: number | null;
  review_due_at: string;
  track: DbTrack | null;
  students?: unknown;
};

export function mapGoalReview(row: GoalQueryRow): ScheduledGoalReview {
  const student = firstOf<{ full_name: string }>(row.students);
  const name = student?.full_name ?? UNKNOWN_LEARNER;

  return {
    id: row.id,
    studentName: name,
    studentInitials: initialsFrom(name),
    tone: toneFor(row.id),
    track: toTrackLabel(row.track ?? "esl"),
    title: row.title,
    reviewDueAt: row.review_due_at,
    progress: row.progress ?? 0,
  };
}

export type CapacityQueryRow = { day: string; capacity: number };

export function mapCapacity(row: CapacityQueryRow): DayCapacity {
  return { date: row.day, capacity: row.capacity };
}
