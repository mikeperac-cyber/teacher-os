/**
 * Teaching-domain record types.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Until now the only specification of what each screen needs was the demo data
 * hard-coded in `app/page.tsx`. That data has been removed. These types are what
 * it left behind: the field-level contract every screen renders against.
 *
 * This file is therefore the source of the Supabase schema. When the SQL
 * migrations in Phase 2 are written, they are derived from these shapes — not
 * guessed — and `docs/DATA_MODEL.md` is the table-level companion to it.
 *
 * INVARIANTS (CLAUDE.md)
 * ----------------------
 * - ESL and IELTS Academic are separate tracking systems. `EslProgressRow` and
 *   `IeltsCandidateRow` are deliberately NOT unified, and there is no shared
 *   generic "score" type. Anything that looks like a simplification here is a
 *   product regression.
 * - Every record will carry `workspace_id` in the database, and every
 *   student-owned record will also carry `student_id`. Those columns are
 *   omitted from these UI types because authorization is enforced in Postgres
 *   (RLS) and on the server, never by the shape of a client-side object.
 *
 * KNOWN GAP
 * ---------
 * Several types carry `icon: ElementType`. That is a rendering concern, not a
 * storable field. When these move to the database, `icon` becomes a string key
 * resolved through a lookup map at render time.
 */

import type { ElementType } from "react";
import type { Area, Tone, Track } from "./ui";

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/** Lifecycle of a single homework item, as shown in the student directory. */
export type HomeworkState =
  | "Assigned"
  | "Submitted"
  | "To check"
  | "Returned"
  | "Late";

/**
 * A learner as displayed in the ESL student directory.
 * Backed by `students` + `esl_student_profiles`.
 */
export type StudentRow = {
  initials: string;
  name: string;
  /** Course name, e.g. "General English", "Young Learner ESL". */
  program: string;
  /** CEFR level for ESL learners, e.g. "B1", "A2+". */
  level: string;
  /** Human-readable next lesson slot, e.g. "Tue · 10:00". */
  next: string;
  hw: HomeworkState;
  /** Overall mastery, 0–100. */
  progress: number;
  tone: Tone;
};

/**
 * An IELTS Academic candidate as displayed in the candidate directory.
 * Backed by `students` + `ielts_student_profiles`.
 */
export type IeltsCandidateRow = {
  initials: string;
  name: string;
  /** Current overall band, e.g. "6.5". */
  current: string;
  /** Target overall band, e.g. "7.0". */
  target: string;
  /** Official test date with countdown, e.g. "12 Oct · 64d". */
  test: string;
  /** Weakest skill and its band, e.g. "Writing 6.0". */
  weakest: string;
  /** Latest mock result, or a pending label. */
  mock: string;
  /** Test readiness, 0–100. */
  ready: number;
  tone: Tone;
};

/* ------------------------------------------------------------------ */
/* Scheduling and the teaching day                                     */
/* ------------------------------------------------------------------ */

/** A lesson in today's schedule. Backed by `lessons`. */
export type ScheduledClass = {
  time: string;
  end: string;
  name: string;
  /** Course and level, e.g. "IELTS Academic · Band 5.5 → 6.5". */
  course: string;
  status: string;
  tone: Tone;
  initials: string;
};

/** A block on the chronological day timeline: lesson, prep, marking or admin. */
export type DayBlock = {
  time: string;
  duration: string;
  title: string;
  meta: string;
  /** Space-separated render hints, e.g. "lesson done", "focus current". */
  kind: string;
  icon: ElementType;
};

/** A lesson record in the lesson history. Backed by `lessons`. */
export type LessonRecord = {
  date: string;
  student: string;
  /** ESL: language outcome. IELTS: question type or skill focus. */
  focus: string;
  length: string;
  status: string;
};

/** An entry in the week calendar grid. Backed by `calendar_events`. */
export type CalendarEvent = {
  /** Column index, 0 = Monday. */
  day: number;
  /** Vertical offset within the day column, as a percentage. */
  top: number;
  /** Rendered height in pixels. */
  height: number;
  title: string;
  time: string;
  /** Tone, or "focus" for protected planning blocks. */
  tone: Tone | "focus";
};

/* ------------------------------------------------------------------ */
/* Lesson preparation                                                  */
/* ------------------------------------------------------------------ */

/** One timed activity in the 60-minute lesson flow. Backed by `lesson_plans`. */
export type LessonBlock = {
  /** Minute range within the lesson, e.g. "18–30". */
  time: string;
  title: string;
  detail: string;
  tone: Tone;
};

/** A material attached to a lesson plan: [name, descriptor]. */
export type AttachedMaterial = [name: string, meta: string];

/** The working lesson brief in the planner. Backed by `lesson_plans`. */
export type LessonPlan = {
  /** Student and slot, e.g. "<student name> · Today at 19:00". */
  student: string;
  /** ESL: CEFR learning outcome. IELTS: band-score objective. */
  objective: string;
  course: string;
  /** ESL: language focus. IELTS: skill or task. */
  skill: string;
  /** Current level or band. */
  level: string;
  /** Mastery target or target band. */
  target: string;
  note: string;
  /** Readiness percentage, e.g. "84%". */
  readiness: string;
  materials: AttachedMaterial[];
  blocks: LessonBlock[];
};

/* ------------------------------------------------------------------ */
/* Homework                                                            */
/* ------------------------------------------------------------------ */

/** Columns of the homework board, in workflow order. */
export type HomeworkColumn =
  | "assigned"
  | "submitted"
  | "checking"
  | "returned";

/** A homework card. Backed by `homework_assignments` + `homework_submissions`. */
export type HomeworkCard = {
  id: number;
  name: string;
  task: string;
  /** Due descriptor, e.g. "Today", "Late · 2d", "Returned". */
  due: string;
  tone: Tone;
};

export type HomeworkBoard = Record<HomeworkColumn, HomeworkCard[]>;

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

/**
 * An item in the marking queue.
 * ESL: a CEFR progress check. IELTS: a mock or timed section.
 * Backed by `assessments`.
 */
export type AssessmentItem = {
  name: string;
  title: string;
  /** ESL: evidence type. IELTS: section or parts covered. */
  type: string;
  submitted: string;
  /** Marking completion, 0–100. */
  progress: number;
  icon: ElementType;
  tone: Tone;
};

/* ------------------------------------------------------------------ */
/* ESL progress — CEFR mastery                                         */
/* ------------------------------------------------------------------ */

/**
 * A learner row in the CEFR skill matrix. Backed by `esl_progress_entries`.
 *
 * `skills` is positional and aligns with `ESL_SKILL_LABELS`:
 * Grammar, Vocabulary, Speaking, Listening, Reading, Confidence.
 * In Postgres this becomes one typed column per skill, not an array — the
 * array here is a rendering convenience only.
 */
export type EslProgressRow = {
  name: string;
  /** Current CEFR level, e.g. "B1". */
  level: string;
  /** Target CEFR level, e.g. "B2". */
  target: string;
  /** Overall mastery, 0–100. */
  overall: number;
  /** Change over the review period, e.g. "+8%". */
  change: string;
  skills: number[];
  tone: Tone;
};

/**
 * Evidence for one language system or skill, split by how reliably the learner
 * can use it. The recognition-to-independent gap is the core ESL diagnostic and
 * has no IELTS equivalent. Backed by `language_outcomes` + `vocabulary_mastery`.
 */
export type LanguageSystemRow = {
  skill: string;
  /** Current teaching focus, e.g. "Past simple vs continuous". */
  focus: string;
  /** Recognizes the form when shown it, 0–100. */
  recognition: number;
  /** Produces it in controlled practice, 0–100. */
  controlled: number;
  /** Produces it spontaneously, 0–100. */
  independent: number;
  /** When spaced review is next due. */
  review: string;
  tone: Tone;
};

/** Compact ESL system meter on the dashboard rail. */
export type EslSystemScore = {
  label: string;
  /** Mastery, 0–100. */
  value: number;
  /** Change over the term, e.g. "+6". */
  delta: string;
};

/** A row of the dashboard CEFR pulse table. */
export type EslPulseRow = {
  name: string;
  cefr: string;
  /** Percentage strings as rendered, e.g. "84%". */
  mastery: string;
  independent: string;
  confidence: string;
  tone: Tone;
};

/* ------------------------------------------------------------------ */
/* IELTS progress — band scores                                        */
/* ------------------------------------------------------------------ */

/** The four IELTS skills, in official reporting order. */
export type IeltsSkill = "Listening" | "Reading" | "Writing" | "Speaking";

/**
 * A candidate row in the band matrix. Backed by `ielts_skill_scores`.
 *
 * `scores` is positional: [Listening, Reading, Writing, Speaking].
 * In Postgres each becomes its own numeric column.
 */
export type IeltsBandRow = {
  name: string;
  /** Official test date, e.g. "12 Oct". */
  test: string;
  scores: number[];
  overall: number;
  target: number;
  tone: Tone;
};

/** Cohort average for one skill on the dashboard rail. */
export type IeltsSkillAverage = {
  skill: IeltsSkill;
  /** Band as rendered, e.g. "6.5". */
  band: string;
  /** Movement over the term, e.g. "+0.5". */
  delta: string;
};

/**
 * IELTS Writing performance. `scores` is positional and aligns with
 * `IELTS_WRITING_CRITERIA`: Task Achievement/Response, Coherence and Cohesion,
 * Lexical Resource, Grammatical Range and Accuracy.
 * Backed by `ielts_writing_submissions` + `ielts_writing_scores`.
 */
export type IeltsWritingRow = {
  name: string;
  /** "Task 1" or "Task 2". */
  task: string;
  scores: number[];
  average: number;
  target: number;
  tone: Tone;
  /** Scripts marked to date. */
  scripts: number;
};

/**
 * IELTS Speaking performance. `scores` is positional and aligns with
 * `IELTS_SPEAKING_CRITERIA`: Fluency and Coherence, Lexical Resource,
 * Grammatical Range and Accuracy, Pronunciation.
 * Backed by `ielts_speaking_recordings` + `ielts_speaking_scores`.
 */
export type IeltsSpeakingRow = {
  name: string;
  scores: number[];
  average: number;
  target: number;
  tone: Tone;
  /** Weakest part, e.g. "Part 2". */
  part: string;
};

/** A recurring error pattern suppressing Writing bands. */
export type WritingErrorPattern = {
  error: string;
  count: number;
  /** Which criterion it maps to. */
  criterion: string;
  tone: Tone;
};

/** Average band by Speaking part. */
export type SpeakingPartAverage = {
  part: string;
  band: string;
  /** Meter width as a percentage, 0–100. */
  width: number;
};

/* ------------------------------------------------------------------ */
/* Shared operational areas                                            */
/* ------------------------------------------------------------------ */

export type Priority = "High" | "Medium" | "Low";

/** A task. Backed by `tasks`. */
export type TaskItem = {
  id: number;
  title: string;
  /** When it is due, e.g. "Today · 18:15". */
  meta: string;
  priority: Priority;
};

/** Tasks grouped by life area: Teaching, Business, Personal. */
export type TaskGroup = { label: string; tone: Tone; tasks: TaskItem[] };

/** A dashboard priority-queue row. Backed by `tasks`. */
export type PriorityItem = {
  id: number;
  title: string;
  meta: string;
  /** Time estimate, e.g. "25 min". */
  tag: string;
  tone: Tone;
};

/** A quarterly goal. Backed by `goals`. */
export type GoalItem = {
  title: string;
  /** Life area, e.g. "Student outcomes". */
  area: string;
  /** Completion, 0–100. */
  progress: number;
  /** Deadline descriptor, e.g. "By 30 Sep". */
  target: string;
  /** Progress metric, e.g. "13 / 24 units". */
  metric: string;
  tone: Tone;
  icon: ElementType;
};

/** A project. Backed by `projects`. */
export type ProjectItem = {
  title: string;
  category: string;
  /** Completion, 0–100. */
  progress: number;
  due: string;
  /** Task completion, e.g. "18 / 25". */
  tasks: string;
  /** Member initials. */
  members: string[];
  tone: Tone;
};

/** A teaching resource. Backed by `materials` + `files`. */
export type MaterialItem = {
  title: string;
  /** Format, e.g. "Worksheet pack", "Audio lesson". */
  type: string;
  /** Level range, e.g. "CEFR B1", "IELTS 5.5–7.0". */
  level: string;
  skill: string;
  tone: Tone;
  /** Times used in a lesson. */
  uses: number;
  icon: ElementType;
};

/** A named collection of materials: [title, count, tone]. */
export type MaterialCollection = [title: string, count: string, tone: string];

/** An available report. */
export type ReportCard = {
  title: string;
  description: string;
  icon: ElementType;
  /** Freshness, e.g. "Updated today". */
  updated: string;
};

/** A learner flagged for follow-up on a dashboard attention card. */
export type AttentionItem = {
  initials: string;
  name: string;
  /** Why they are flagged, e.g. "Active vocabulary gap". */
  reason: string;
  tone: Tone;
  /** Where the follow-up opens. */
  area: Area;
};

/** A global-search result. */
export type SearchResult = {
  title: string;
  meta: string;
  area: Area;
  icon: ElementType;
  track: Track;
};

/** A dashboard student-pulse row. */
export type StudentPulse = {
  name: string;
  /** Track and level, e.g. "ESL · B1". */
  track: string;
  /** Progress, 0–100. */
  value: number;
  /** Change, e.g. "+8%". */
  delta: string;
  color: Tone;
};

/* ------------------------------------------------------------------ */
/* Triage source records                                               */
/* ------------------------------------------------------------------ */
/* These feed the dashboard derivations in `lib/dashboard/`. They carry ISO   */
/* timestamps rather than the pre-rendered strings used by the directory      */
/* views above, because triage has to do arithmetic on them — how overdue,    */
/* how many days inactive, how long until the lesson starts.                  */

/** A scheduled lesson with everything the next-up panel and prep check need. */
export type UpcomingLesson = {
  id: string;
  studentId: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  track: Track;
  /** Course and level, e.g. "IELTS Academic · Band 6.0 → 7.0". */
  courseLabel: string;
  /** ISO start timestamp. */
  startsAt: string;
  /** ISO end timestamp. */
  endsAt: string;
  /** ESL: communicative outcome. IELTS: band objective. Null if unplanned. */
  objective: string | null;
  hasPlan: boolean;
  /** Materials attached to the plan. */
  materialCount: number;
  /** Whether the previous homework has been checked and returned. */
  homeworkReturned: boolean;
  /** ISO timestamp of the last goal review, or null if never reviewed. */
  goalsReviewedAt: string | null;
  /** Post-class notes from this student's previous lesson. */
  lastNotes: string | null;
};

/**
 * Raw triage facts for one learner.
 *
 * Kept separate from `StudentRow` / `IeltsCandidateRow` because those describe
 * how a learner is *displayed* in a directory, whereas this describes what the
 * system *knows* about their engagement. Mixing them would force directory
 * queries to carry risk columns they never render.
 */
export type StudentSignal = {
  studentId: string;
  name: string;
  initials: string;
  tone: Tone;
  track: Track;
  /** ISO timestamp of the last lesson, submission or sign-in. */
  lastActiveAt: string | null;
  /** Assignments past their due date with no submission. */
  missedHomework: number;
  /** ISO timestamp of the most recent recorded progress change. */
  lastProgressAt: string | null;
  /** ESL only: overall CEFR mastery, 0–100, most recent last. */
  masteryHistory?: number[];
  /** IELTS only: overall band, most recent last. */
  bandHistory?: number[];
  /** IELTS only. */
  targetBand?: number;
  /** IELTS only: ISO date of the official test. */
  testDate?: string | null;
};

/** Homework awaiting the teacher. Backed by `homework_submissions`. */
export type PendingHomework = {
  id: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  track: Track;
  task: string;
  /** ISO timestamp the teacher should return it by. */
  dueAt: string | null;
  /** Lesson this must be returned before, if any. */
  blocksLessonId: string | null;
  /** Estimated marking time. */
  minutes: number | null;
};

/** An assessment whose scores have not been recorded. Backed by `assessments`. */
export type PendingAssessment = {
  id: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  track: Track;
  title: string;
  /** ESL: evidence type. IELTS: mock or section. */
  kind: string;
  dueAt: string | null;
  blocksLessonId: string | null;
  minutes: number | null;
};

/** A task with a real timestamp, for inbox ranking. Backed by `tasks`. */
export type ScheduledTask = {
  id: string;
  title: string;
  detail: string;
  dueAt: string | null;
  priority: Priority;
  minutes: number | null;
  track: Track | null;
  tone: Tone;
};

/** A student goal with a scheduled review. Backed by `goals`. */
export type ScheduledGoalReview = {
  id: string;
  studentName: string;
  studentInitials: string;
  tone: Tone;
  track: Track;
  title: string;
  /** ISO date the review is due. */
  reviewDueAt: string;
  /** 0–100. */
  progress: number;
};

/**
 * How many lessons the teacher is willing to take on a given day.
 *
 * Capacity is a preference, not a record of bookings — it is what makes
 * overbooking and empty days detectable rather than merely visible.
 */
export type DayCapacity = {
  /** ISO date. */
  date: string;
  capacity: number;
};

/* ------------------------------------------------------------------ */
/* Positional label constants                                          */
/* ------------------------------------------------------------------ */
/* These are official criterion names, not demo data. They define the order  */
/* of the positional score arrays above and must not be reordered.           */

export const ESL_SKILL_LABELS = [
  "Grammar",
  "Vocabulary",
  "Speaking",
  "Listening",
  "Reading",
  "Confidence",
] as const;

export const IELTS_SKILLS: readonly IeltsSkill[] = [
  "Listening",
  "Reading",
  "Writing",
  "Speaking",
] as const;

/** Official IELTS Writing assessment criteria. */
export const IELTS_WRITING_CRITERIA = [
  "Task Achievement / Task Response",
  "Coherence and Cohesion",
  "Lexical Resource",
  "Grammatical Range and Accuracy",
] as const;

/** Official IELTS Speaking assessment criteria. */
export const IELTS_SPEAKING_CRITERIA = [
  "Fluency and Coherence",
  "Lexical Resource",
  "Grammatical Range and Accuracy",
  "Pronunciation",
] as const;
