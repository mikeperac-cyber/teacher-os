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
 */

import { createClient } from "@/lib/supabase/server";
import { toTrackLabel } from "@/lib/types/database";
import type {
  DayCapacity,
  PendingAssessment,
  PendingHomework,
  ScheduledGoalReview,
  ScheduledTask,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";
import type { Priority } from "@/lib/types/domain";
import type { TriageData } from "@/lib/types/dashboard";

export type { TriageData };

import { emptyTriage, initialsFrom, toneFor } from "./shared";


/** How far ahead the dashboard looks. Beyond this belongs in Calendar. */
const LESSON_HORIZON_DAYS = 14;

const PRIORITY_LABEL: Record<string, Priority> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
  // Include lessons that started recently so one in progress still counts as
  // "next up" (see RECENTLY_ENDED_GRACE_MINUTES in lib/dashboard/next-lesson).
  const since = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

  const [
    lessonsResult,
    studentsResult,
    submissionsResult,
    tasksResult,
    goalsResult,
    capacitiesResult,
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        `id, student_id, track, starts_at, ends_at, status,
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
        `id, full_name, track, status,
         ielts_student_profiles ( target_band, test_date )`,
      )
      .eq("status", "active"),

    supabase
      .from("homework_submissions")
      .select(
        `id, student_id, status, submitted_at,
         homework_assignments ( title, track, due_at, estimated_minutes, blocks_lesson_id ),
         students ( full_name ),
         homework_feedback ( id )`,
      )
      .in("status", ["submitted", "checking"]),

    supabase
      .from("tasks")
      .select("id, title, detail, priority, due_at, estimated_minutes, track")
      .is("completed_at", null)
      .not("due_at", "is", null),

    supabase
      .from("goals")
      .select("id, title, progress, review_due_at, track, students ( full_name )")
      .not("review_due_at", "is", null)
      .not("student_id", "is", null),

    supabase.from("day_capacities").select("id, day, capacity"),
  ]);

  const upcomingLessons: UpcomingLesson[] = (lessonsResult.data ?? []).map(
    (row) => {
      const student = row.students as unknown as { full_name: string } | null;
      const plan = (row.lesson_plans as unknown as
        | { objective: string | null; blocks: unknown }[]
        | null)?.[0];
      const name = student?.full_name ?? "Unknown learner";
      const blocks = Array.isArray(plan?.blocks) ? plan.blocks : [];

      return {
        id: row.id as string,
        studentId: row.student_id as string,
        studentName: name,
        studentInitials: initialsFrom(name),
        tone: toneFor(row.student_id as string),
        track: toTrackLabel(row.track as "esl" | "ielts"),
        courseLabel: toTrackLabel(row.track as "esl" | "ielts") === "ESL"
          ? "ESL"
          : "IELTS Academic",
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
        objective: plan?.objective ?? null,
        hasPlan: Boolean(plan),
        materialCount: blocks.length,
        // Filled from the homework pass below.
        homeworkReturned: true,
        goalsReviewedAt: null,
        lastNotes: null,
      };
    },
  );

  const pendingHomework: PendingHomework[] = (submissionsResult.data ?? [])
    .filter((row) => {
      // Only work that still needs the teacher: a submission with released
      // feedback is finished.
      const feedback = row.homework_feedback as unknown as { id: string }[] | null;
      return !feedback || feedback.length === 0;
    })
    .map((row) => {
      const assignment = row.homework_assignments as unknown as {
        title: string;
        track: "esl" | "ielts";
        due_at: string | null;
        estimated_minutes: number | null;
        blocks_lesson_id: string | null;
      } | null;
      const student = row.students as unknown as { full_name: string } | null;
      const name = student?.full_name ?? "Unknown learner";

      return {
        id: row.id as string,
        studentName: name,
        studentInitials: initialsFrom(name),
        tone: toneFor(row.student_id as string),
        track: toTrackLabel(assignment?.track ?? "esl"),
        task: assignment?.title ?? "Homework",
        dueAt: assignment?.due_at ?? null,
        blocksLessonId: assignment?.blocks_lesson_id ?? null,
        minutes: assignment?.estimated_minutes ?? null,
      };
    });

  // A lesson is not ready if the learner has work still waiting on the teacher.
  const studentsAwaitingFeedback = new Set(
    (submissionsResult.data ?? []).map((row) => row.student_id as string),
  );
  for (const lesson of upcomingLessons) {
    lesson.homeworkReturned = !studentsAwaitingFeedback.has(lesson.studentId);
  }

  const studentSignals: StudentSignal[] = (studentsResult.data ?? []).map(
    (row) => {
      const ielts = (row.ielts_student_profiles as unknown as
        | { target_band: number | null; test_date: string | null }[]
        | null)?.[0];
      const name = row.full_name as string;

      return {
        studentId: row.id as string,
        name,
        initials: initialsFrom(name),
        tone: toneFor(row.id as string),
        track: toTrackLabel(row.track as "esl" | "ielts"),
        // Populated by a dedicated aggregate in a later pass; null here means
        // "not known", and the at-risk rules already treat that as no evidence
        // rather than as good news.
        lastActiveAt: null,
        missedHomework: 0,
        lastProgressAt: null,
        targetBand: ielts?.target_band ?? undefined,
        testDate: ielts?.test_date ?? null,
      };
    },
  );

  const scheduledTasks: ScheduledTask[] = (tasksResult.data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    detail: (row.detail as string | null) ?? "",
    dueAt: row.due_at as string | null,
    priority: PRIORITY_LABEL[row.priority as string] ?? "Medium",
    minutes: (row.estimated_minutes as number | null) ?? null,
    track: row.track ? toTrackLabel(row.track as "esl" | "ielts") : null,
    tone: toneFor(row.id as string),
  }));

  const goalReviews: ScheduledGoalReview[] = (goalsResult.data ?? []).map(
    (row) => {
      const student = row.students as unknown as { full_name: string } | null;
      const name = student?.full_name ?? "Unknown learner";
      return {
        id: row.id as string,
        studentName: name,
        studentInitials: initialsFrom(name),
        tone: toneFor(row.id as string),
        track: toTrackLabel((row.track as "esl" | "ielts") ?? "esl"),
        title: row.title as string,
        reviewDueAt: row.review_due_at as string,
        progress: (row.progress as number) ?? 0,
      };
    },
  );

  const dayCapacities: DayCapacity[] = (capacitiesResult.data ?? []).map(
    (row) => ({
      date: row.day as string,
      capacity: row.capacity as number,
    }),
  );

  return {
    upcomingLessons,
    studentSignals,
    pendingHomework,
    // Assessment marking joins the inbox once the assessment screens are wired.
    pendingAssessments: [],
    scheduledTasks,
    goalReviews,
    dayCapacities,
  };
}
