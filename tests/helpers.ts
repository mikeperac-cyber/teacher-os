/**
 * Test factories.
 *
 * Every dashboard rule takes `now` explicitly, so tests fix a reference instant
 * and build records relative to it. Nothing here reads the real clock, which is
 * what makes claims like "overdue by 2 days" verifiable without waiting.
 */

import type {
  PendingAssessment,
  PendingHomework,
  ScheduledGoalReview,
  ScheduledTask,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";

/** Fixed reference instant: Monday 10 August 2026, 09:00 local. */
export const NOW = new Date(2026, 7, 10, 9, 0, 0);

export const daysFromNow = (days: number, hour = 9) =>
  new Date(2026, 7, 10 + days, hour, 0, 0);

export const hoursFromNow = (hours: number) =>
  new Date(NOW.getTime() + hours * 60 * 60 * 1000);

export const iso = (date: Date) => date.toISOString();

export function signal(overrides: Partial<StudentSignal> = {}): StudentSignal {
  return {
    studentId: "s1",
    name: "Test Learner",
    initials: "TL",
    tone: "violet",
    track: "ESL",
    lastActiveAt: iso(NOW),
    missedHomework: 0,
    lastProgressAt: iso(NOW),
    ...overrides,
  };
}

export function lesson(overrides: Partial<UpcomingLesson> = {}): UpcomingLesson {
  return {
    id: "l1",
    studentId: "s1",
    studentName: "Test Learner",
    studentInitials: "TL",
    tone: "violet",
    track: "ESL",
    courseLabel: "General English · B1",
    startsAt: iso(hoursFromNow(2)),
    endsAt: iso(hoursFromNow(3)),
    objective: "Narrate a past event",
    hasPlan: true,
    materialCount: 2,
    homeworkReturned: true,
    goalsReviewedAt: iso(daysFromNow(-3)),
    lastNotes: "Confident with past simple",
    ...overrides,
  };
}

export function homework(
  overrides: Partial<PendingHomework> = {},
): PendingHomework {
  return {
    id: "h1",
    studentName: "Test Learner",
    studentInitials: "TL",
    tone: "amber",
    track: "ESL",
    task: "Unit 6 vocabulary",
    dueAt: iso(hoursFromNow(4)),
    blocksLessonId: null,
    minutes: 20,
    ...overrides,
  };
}

export function assessment(
  overrides: Partial<PendingAssessment> = {},
): PendingAssessment {
  return {
    id: "a1",
    studentName: "Test Learner",
    studentInitials: "TL",
    tone: "blue",
    track: "IELTS",
    title: "Speaking mock",
    kind: "Parts 1–3",
    dueAt: iso(hoursFromNow(6)),
    blocksLessonId: null,
    minutes: 25,
    ...overrides,
  };
}

export function task(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "t1",
    title: "Upload invoices",
    detail: "Business admin",
    dueAt: iso(hoursFromNow(3)),
    priority: "Medium",
    minutes: 15,
    track: null,
    tone: "blue",
    ...overrides,
  };
}

export function goalReview(
  overrides: Partial<ScheduledGoalReview> = {},
): ScheduledGoalReview {
  return {
    id: "g1",
    studentName: "Test Learner",
    studentInitials: "TL",
    tone: "mint",
    track: "ESL",
    title: "Speak for two minutes unprompted",
    reviewDueAt: iso(daysFromNow(3)),
    progress: 40,
    ...overrides,
  };
}
