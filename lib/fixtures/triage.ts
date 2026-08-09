/**
 * Triage source records for the dashboard.
 * Empty until Supabase is connected — see ./README.md.
 *
 * These carry ISO timestamps rather than pre-rendered strings, because the
 * derivations in `lib/dashboard/` do arithmetic on them: how overdue, how many
 * days inactive, how long until the lesson starts.
 *
 * Each export below maps to one query in Phase 3:
 *
 *   upcomingLessons    → lessons JOIN lesson_plans, next 7 days, RLS-scoped
 *   studentSignals     → students LEFT JOIN last activity, homework, progress
 *   pendingHomework    → homework_submissions WHERE feedback IS NULL
 *   pendingAssessments → assessments WHERE scores IS NULL
 *   scheduledTasks     → tasks WHERE due_at IS NOT NULL
 *   goalReviews        → goals WHERE review_due_at IS NOT NULL
 *   dayCapacities      → teacher availability preferences
 */

import type {
  DayCapacity,
  PendingAssessment,
  PendingHomework,
  ScheduledGoalReview,
  ScheduledTask,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";

/** Scheduled lessons, both tracks. Feeds next-up, prep and capacity. */
export const upcomingLessons: UpcomingLesson[] = [];

/** Engagement facts per learner. Feeds at-risk triage and stats. */
export const studentSignals: StudentSignal[] = [];

/** Submitted work awaiting feedback. Feeds the action inbox. */
export const pendingHomework: PendingHomework[] = [];

/** Assessments awaiting scores. Feeds the action inbox. */
export const pendingAssessments: PendingAssessment[] = [];

/** Tasks with due dates. Only overdue or due-today reach the inbox. */
export const scheduledTasks: ScheduledTask[] = [];

/** Student goals with scheduled reviews. */
export const goalReviews: ScheduledGoalReview[] = [];

/**
 * How many lessons the teacher is willing to take per day.
 *
 * Empty means no stated preference, and the capacity strip makes no judgement
 * about overbooking — it cannot know that four lessons is too many until the
 * teacher says so.
 */
export const dayCapacities: DayCapacity[] = [];
