/**
 * Row shapes for the tables the application queries.
 *
 * WHY THIS IS HAND-WRITTEN
 * ------------------------
 * `supabase gen types typescript` produces this file from a live project, and
 * that is what should generate it once one exists (see docs/SUPABASE_SETUP.md).
 * No project exists yet, so these are written from the migrations by hand and
 * cover only what is actually selected.
 *
 * When the generated file arrives it replaces this one. Until then, a change to
 * `supabase/migrations/` means a change here too — `tests/db/` will not catch a
 * drift between the two, because it queries SQL directly rather than through
 * these types.
 */

export type Track = "esl" | "ielts";
export type WorkspaceRole = "owner" | "teacher" | "student";
export type LessonStatus =
  | "scheduled"
  | "delivered"
  | "cancelled"
  | "rescheduled";
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "checking"
  | "returned";
export type TaskPriority = "high" | "medium" | "low";
export type IeltsSkill = "listening" | "reading" | "writing" | "speaking";

export type StudentRow = {
  id: string;
  workspace_id: string;
  track: Track;
  full_name: string;
  preferred_name: string | null;
  email: string | null;
  status: string;
  started_at: string;
  notes: string | null;
};

export type LessonRow = {
  id: string;
  workspace_id: string;
  student_id: string;
  track: Track;
  starts_at: string;
  ends_at: string;
  status: LessonStatus;
  title: string | null;
  attended: boolean | null;
};

export type LessonPlanRow = {
  id: string;
  lesson_id: string;
  student_id: string;
  track: Track;
  objective: string | null;
  focus: string | null;
  teacher_note: string | null;
  blocks: unknown;
  marked_ready_at: string | null;
};

export type LessonNoteRow = {
  id: string;
  lesson_id: string;
  student_id: string;
  body: string;
  shared_with_student: boolean;
  created_at: string;
};

export type HomeworkAssignmentRow = {
  id: string;
  workspace_id: string;
  student_id: string;
  track: Track;
  lesson_id: string | null;
  blocks_lesson_id: string | null;
  title: string;
  instructions: string | null;
  due_at: string | null;
  estimated_minutes: number | null;
};

export type HomeworkSubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  body: string | null;
  submitted_at: string | null;
  returned_at: string | null;
};

export type HomeworkFeedbackRow = {
  id: string;
  submission_id: string;
  student_id: string;
  body: string;
  released_at: string | null;
};

export type EslProgressRow = {
  id: string;
  student_id: string;
  recorded_at: string;
  grammar: number | null;
  vocabulary: number | null;
  speaking: number | null;
  listening: number | null;
  reading: number | null;
  confidence: number | null;
  overall: number | null;
  note: string | null;
  released_at: string | null;
};

export type IeltsSkillScoreRow = {
  id: string;
  student_id: string;
  skill: IeltsSkill;
  band: number;
  recorded_at: string;
  released_at: string | null;
};

export type IeltsProfileRow = {
  id: string;
  student_id: string;
  target_band: number | null;
  test_date: string | null;
};

export type EslProfileRow = {
  id: string;
  student_id: string;
  current_cefr: string | null;
  target_cefr: string | null;
  course_name: string | null;
};

export type TaskRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  due_at: string | null;
  estimated_minutes: number | null;
  completed_at: string | null;
  track: Track | null;
};

export type GoalRow = {
  id: string;
  workspace_id: string;
  student_id: string | null;
  track: Track | null;
  title: string;
  progress: number;
  review_due_at: string | null;
};

export type DayCapacityRow = {
  id: string;
  day: string;
  capacity: number;
};

/** Maps the database's lowercase track to the interface's display form. */
export const toTrackLabel = (track: Track): "ESL" | "IELTS" =>
  track === "esl" ? "ESL" : "IELTS";

/** Maps the interface's display form back to the database enum. */
export const toTrackValue = (track: "ESL" | "IELTS"): Track =>
  track === "ESL" ? "esl" : "ielts";
