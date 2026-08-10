import "server-only";

/**
 * Everything the dashboard needs, fetched once per request.
 *
 * Returns the same shapes `lib/fixtures/triage.ts` returned, so the triage
 * rules in `lib/dashboard/` and every panel component are untouched. The
 * fixtures proved the contract; these fulfil it.
 *
 * Every query runs through the user-scoped client, so Row Level Security
 * decides what comes back. There is no `workspace_id` filter in application
 * code and there should not be — adding one would create a second, weaker copy
 * of a rule Postgres already enforces, and the two would eventually disagree.
 *
 * Row-to-domain mapping lives in `./mappers.ts` so it can be tested. This file
 * is `server-only` and a test cannot import it.
 */

import { createClient } from "@/lib/supabase/server";
import type { TriageData } from "@/lib/types/dashboard";

import {
  mapCapacity,
  mapGoalReview,
  mapLesson,
  mapStudentSignal,
  mapSubmission,
  mapTask,
  needsTeacher,
  type CapacityQueryRow,
  type GoalQueryRow,
  type LessonQueryRow,
  type StudentQueryRow,
  type SubmissionQueryRow,
  type TaskQueryRow,
} from "./mappers";
import { emptyTriage } from "./shared";

export type { TriageData };

/** How far ahead the dashboard looks. Beyond this belongs in Calendar. */
const LESSON_HORIZON_DAYS = 14;

/**
 * How far back to include a lesson that has already started.
 *
 * Long enough that one running now is still "next up", short enough that
 * yesterday's does not resurface.
 */
const IN_PROGRESS_GRACE_HOURS = 4;

export async function getTriageData(now: Date): Promise<TriageData> {
  const supabase = await createClient();
  if (!supabase) return emptyTriage();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyTriage();

  const horizon = new Date(
    now.getTime() + LESSON_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const since = new Date(
    now.getTime() - IN_PROGRESS_GRACE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const [
    lessonsResult,
    studentsResult,
    submissionsResult,
    tasksResult,
    goalsResult,
    capacitiesResult,
    notesResult,
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        `id, student_id, track, starts_at, ends_at,
         students ( full_name ),
         lesson_plans ( objective, blocks )`,
      )
      .eq("status", "scheduled")
      .gte("starts_at", since)
      .lte("starts_at", horizon)
      .order("starts_at", { ascending: true }),

    supabase
      .from("students")
      .select(
        `id, full_name, track,
         ielts_student_profiles ( target_band, test_date )`,
      )
      .eq("status", "active"),

    supabase
      .from("homework_submissions")
      .select(
        `id, student_id, status,
         homework_assignments ( title, track, due_at, estimated_minutes, blocks_lesson_id ),
         students ( full_name ),
         homework_feedback ( released_at )`,
      )
      .in("status", ["submitted", "checking"]),

    supabase
      .from("tasks")
      .select("id, title, detail, priority, due_at, estimated_minutes, track")
      .is("completed_at", null)
      .not("due_at", "is", null),

    supabase
      .from("goals")
      .select(
        "id, title, progress, review_due_at, last_reviewed_at, track, student_id, students ( full_name )",
      )
      .not("student_id", "is", null),

    supabase.from("day_capacities").select("day, capacity"),

    // Most recent post-class note per learner, for the next-up panel's
    // "last notes" shortcut. Ordered so the newest wins when reduced below.
    supabase
      .from("lesson_notes")
      .select("student_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const upcomingLessons = ((lessonsResult.data ?? []) as LessonQueryRow[]).map(
    mapLesson,
  );

  const submissionRows = (submissionsResult.data ?? []) as SubmissionQueryRow[];
  const outstanding = submissionRows.filter(needsTeacher);
  const pendingHomework = outstanding.map(mapSubmission);

  // A lesson is not ready if that learner has work still waiting on the teacher.
  const awaitingFeedback = new Set(outstanding.map((row) => row.student_id));

  // Newest note per learner. The query is already newest-first, so the first
  // one seen for a student is the one to keep.
  const latestNote = new Map<string, string>();
  for (const row of (notesResult.data ?? []) as {
    student_id: string;
    body: string;
  }[]) {
    if (!latestNote.has(row.student_id)) {
      latestNote.set(row.student_id, row.body);
    }
  }

  const goalRows = (goalsResult.data ?? []) as (GoalQueryRow & {
    student_id: string;
    last_reviewed_at: string | null;
  })[];

  // Most recent goal review per learner, for the prep checklist.
  const lastGoalReview = new Map<string, string>();
  for (const row of goalRows) {
    const reviewed = row.last_reviewed_at;
    if (!reviewed) continue;
    const existing = lastGoalReview.get(row.student_id);
    if (!existing || reviewed > existing) {
      lastGoalReview.set(row.student_id, reviewed);
    }
  }

  for (const lesson of upcomingLessons) {
    lesson.homeworkReturned = !awaitingFeedback.has(lesson.studentId);
    lesson.goalsReviewedAt = lastGoalReview.get(lesson.studentId) ?? null;
    lesson.lastNotes = latestNote.get(lesson.studentId) ?? null;
  }

  return {
    upcomingLessons,
    studentSignals: ((studentsResult.data ?? []) as StudentQueryRow[]).map(
      mapStudentSignal,
    ),
    pendingHomework,
    // Assessment marking joins the inbox once the assessment screens are wired.
    pendingAssessments: [],
    scheduledTasks: ((tasksResult.data ?? []) as TaskQueryRow[]).map(mapTask),
    goalReviews: goalRows
      .filter((row) => row.review_due_at !== null)
      .map(mapGoalReview),
    dayCapacities: ((capacitiesResult.data ?? []) as CapacityQueryRow[]).map(
      mapCapacity,
    ),
  };
}
