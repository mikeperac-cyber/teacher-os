/**
 * Triage types for the dashboard.
 *
 * The dashboard answers one question: what needs me now. These types describe
 * the *derived* surfaces that answer it — the next lesson, what is blocking it,
 * the merged action queue, and which learners need intervention.
 *
 * Nothing here is stored. Every value is computed from the records in
 * `lib/types/domain.ts` by the pure functions in `lib/dashboard/`. That
 * separation is deliberate: the triage rules are the product's judgement, so
 * they belong in reviewable, testable code rather than in a query or a
 * component.
 */

import type { ElementType } from "react";
import type { Tone } from "./ui";
import type { Area, Track } from "./ui";

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where a triage item sends the teacher.
 *
 * Every item on the dashboard must be actionable in one click, so each carries
 * its own destination rather than relying on the caller to guess. `detail`
 * becomes the `detail` URL parameter, preserving the existing URL contract.
 */
export type DeepLink = { area: Area; detail?: string };

/* ------------------------------------------------------------------ */
/* 1. Next-up lesson                                                   */
/* ------------------------------------------------------------------ */

/** The single lesson the teacher should be thinking about right now. */
export type NextUpLesson = {
  lessonId: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  /** Course and level, e.g. "IELTS Academic · Band 6.0 → 7.0". */
  courseLabel: string;
  /** ISO start time. */
  startsAt: string;
  /** Rendered clock range, e.g. "19:00–20:00". */
  timeLabel: string;
  /** Minutes until start. Negative once the lesson is under way. */
  minutesUntil: number;
  /** True while the lesson is running. */
  inProgress: boolean;
  /** ESL: communicative outcome. IELTS: band objective. Null if unplanned. */
  objective: string | null;
  /** 0–100, from the prep checklist. */
  readiness: number;
  hasPlan: boolean;
  /** Timed activities in the saved lesson flow. */
  plannedBlocks: number;
  /** Post-class notes from this student's previous lesson. */
  lastNotes: string | null;
  links: {
    plan: DeepLink;
    materials: DeepLink;
    lastNotes: DeepLink;
    student: DeepLink;
  };
};

/* ------------------------------------------------------------------ */
/* 2. Prep checklist                                                   */
/* ------------------------------------------------------------------ */

/**
 * One readiness requirement for an upcoming lesson.
 *
 * `blocking` is what makes this a checklist rather than a schedule: an unmet
 * blocking item means the lesson genuinely cannot run well, and it is surfaced
 * ahead of everything else.
 */
export type PrepItem = {
  id: string;
  label: string;
  detail: string;
  ready: boolean;
  blocking: boolean;
  /** Where the teacher goes to resolve it. */
  link: DeepLink;
};

export type PrepStatus = {
  items: PrepItem[];
  /** 0–100. */
  readiness: number;
  /** Unmet blocking items, in the order they should be resolved. */
  blockers: PrepItem[];
  ready: boolean;
};

/* ------------------------------------------------------------------ */
/* 3. Action inbox                                                     */
/* ------------------------------------------------------------------ */

export type ActionKind = "homework" | "assessment" | "task";

/**
 * One entry in the merged queue.
 *
 * Homework to grade, assessments to record and overdue tasks were previously
 * three separate lists. They compete for the same scarce resource — the
 * teacher's time before the next lesson — so they are ranked against each
 * other, not shown side by side.
 */
export type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  subtitle: string;
  /** ISO due timestamp, or null when nothing is scheduled. */
  dueAt: string | null;
  /** Human-readable due label, e.g. "Overdue by 2 days", "Before 17:00". */
  dueLabel: string;
  overdue: boolean;
  /**
   * True when this blocks the next lesson — for example homework that must be
   * returned before the class it belongs to. These sort above everything.
   */
  blocksNextLesson: boolean;
  /** Estimated minutes, when known. */
  minutes: number | null;
  /** Computed rank; lower sorts first. See `lib/dashboard/action-inbox.ts`. */
  score: number;
  tone: Tone;
  icon: ElementType;
  link: DeepLink;
};

/* ------------------------------------------------------------------ */
/* 4. At-risk students                                                 */
/* ------------------------------------------------------------------ */

export type RiskReason =
  | "missed-homework"
  | "stalled-band"
  | "stalled-mastery"
  | "inactive"
  | "test-approaching";

export type RiskSeverity = "high" | "watch";

export type RiskFlag = {
  reason: RiskReason;
  severity: RiskSeverity;
  /** One-line explanation, e.g. "3 assignments missed". */
  detail: string;
};

/** A learner needing intervention, with every reason they were flagged. */
export type AtRiskStudent = {
  studentId: string;
  name: string;
  initials: string;
  tone: Tone;
  track: Track;
  flags: RiskFlag[];
  severity: RiskSeverity;
  /** Computed rank; lower sorts first. */
  score: number;
  link: DeepLink;
};

/* ------------------------------------------------------------------ */
/* 6. Week capacity                                                    */
/* ------------------------------------------------------------------ */

export type CapacityDay = {
  /** Short weekday label, e.g. "Mon". */
  label: string;
  /** ISO date. */
  date: string;
  booked: number;
  /** Teaching slots the teacher is willing to fill that day. */
  capacity: number;
  isToday: boolean;
  /** Booked beyond capacity. */
  overbooked: boolean;
  /** Nothing booked on a day the teacher is available — makeup opportunity. */
  empty: boolean;
};

export type WeekCapacity = {
  days: CapacityDay[];
  totalBooked: number;
  totalCapacity: number;
  /** 0–100. */
  utilization: number;
  overbookedDays: CapacityDay[];
  openDays: CapacityDay[];
};

/* ------------------------------------------------------------------ */
/* 7. Goals due                                                        */
/* ------------------------------------------------------------------ */

/** A student goal whose review is due, so progress is not lost between lessons. */
export type GoalDue = {
  id: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  title: string;
  /** ISO review date. */
  reviewDueAt: string;
  /** Negative once overdue. */
  daysUntilReview: number;
  overdue: boolean;
  /** 0–100. */
  progress: number;
  link: DeepLink;
};

/* ------------------------------------------------------------------ */
/* 8. Clickable stats                                                  */
/* ------------------------------------------------------------------ */

/**
 * A headline figure that is also a route.
 *
 * A count nobody can act on is a vanity metric. Every stat therefore carries
 * the filtered destination that explains it.
 */
export type DashboardStat = {
  id: string;
  label: string;
  /** Rendered value; "—" when it cannot be derived. */
  value: string;
  /** Supporting line, e.g. "1 is overdue". */
  note: string;
  tone: string;
  icon: ElementType;
  link: DeepLink;
  /** True when the underlying figure needs records that do not exist yet. */
  pending: boolean;
};

/* ------------------------------------------------------------------ */
/* Fetched triage data                                                 */
/* ------------------------------------------------------------------ */

/**
 * Everything the dashboard renders, for one request.
 *
 * Declared here rather than beside the query that produces it, because client
 * components import this type and `lib/queries/triage.ts` is `server-only`.
 * Keeping the type here means there is no path, even a type-only one, from a
 * client component into server code.
 */
export type TriageData = {
  upcomingLessons: import("./domain").UpcomingLesson[];
  studentSignals: import("./domain").StudentSignal[];
  pendingHomework: import("./domain").PendingHomework[];
  pendingAssessments: import("./domain").PendingAssessment[];
  scheduledTasks: import("./domain").ScheduledTask[];
  goalReviews: import("./domain").ScheduledGoalReview[];
  dayCapacities: import("./domain").DayCapacity[];
};
