/**
 * Database rows → what the learner sees.
 *
 * Pure and separate from `student.ts`, which is `server-only` and cannot be
 * imported by a test. The same split as `mappers.ts`, for the same reason: this
 * is the layer where a silent mistake looks like an empty screen rather than an
 * error.
 *
 * `firstOf` is reused rather than reimplemented, because the embed-shape trap
 * applies here too — `homework_submissions.homework_feedback` is one-to-one via
 * a unique constraint and comes back as an object, not an array.
 */

import { toTrackLabel } from "@/lib/types/database";
import type { Track as DbTrack } from "@/lib/types/database";
import type {
  EslMasteryEntry,
  IeltsBandEntry,
  StudentHomework,
  StudentHomeworkState,
  StudentLesson,
} from "@/lib/types/student";

import { firstOf } from "./mappers";

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

export type StudentLessonRow = {
  id: string;
  track: DbTrack;
  starts_at: string;
  ends_at: string;
};

export function mapStudentLesson(
  row: StudentLessonRow,
  sharedNote: string | null = null,
): StudentLesson {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    track: toTrackLabel(row.track),
    sharedNote,
  };
}

/* ------------------------------------------------------------------ */
/* Homework                                                            */
/* ------------------------------------------------------------------ */

export type StudentAssignmentRow = {
  id: string;
  title: string;
  instructions: string | null;
  track: DbTrack;
  due_at: string | null;
  estimated_minutes: number | null;
  homework_submissions?: unknown;
};

type SubmissionEmbed = {
  id: string;
  status: string;
  body: string | null;
  homework_feedback?: unknown;
};

type FeedbackEmbed = {
  body: string;
  released_at: string | null;
};

/**
 * Where this assignment stands for the learner.
 *
 * Note what "returned" requires: feedback that exists *and* carries a release
 * timestamp. A submission whose status the teacher set to 'returned' but whose
 * feedback is still held back reads as `submitted` — because from the learner's
 * side, nothing has come back. Trusting the status column alone would show
 * "returned" next to an empty feedback panel.
 */
export function stateOf(
  submission: SubmissionEmbed | null,
  feedback: FeedbackEmbed | null,
): StudentHomeworkState {
  if (!submission) return "todo";
  if (feedback?.released_at) return "returned";
  if (submission.status === "draft") return "draft";
  return "submitted";
}

export function mapStudentHomework(
  row: StudentAssignmentRow,
): StudentHomework {
  const submission = firstOf<SubmissionEmbed>(row.homework_submissions);
  const feedback = submission
    ? firstOf<FeedbackEmbed>(submission.homework_feedback)
    : null;
  const released = feedback?.released_at ? feedback : null;

  return {
    assignmentId: row.id,
    submissionId: submission?.id ?? null,
    title: row.title,
    instructions: row.instructions,
    track: toTrackLabel(row.track),
    dueAt: row.due_at,
    estimatedMinutes: row.estimated_minutes,
    state: stateOf(submission, feedback),
    body: submission?.body ?? "",
    // Belt and braces. The policy already withholds unreleased feedback, so a
    // row with a null `released_at` should never arrive — but if one ever did,
    // through a policy change or a service-role query, this refuses to render
    // it rather than trusting whatever came back.
    feedback: released?.body ?? null,
    feedbackReleasedAt: released?.released_at ?? null,
  };
}

/** Outstanding work first, then by due date, soonest first. */
export function sortHomework(items: StudentHomework[]): StudentHomework[] {
  const rank: Record<StudentHomeworkState, number> = {
    todo: 0,
    draft: 1,
    submitted: 2,
    returned: 3,
  };
  return [...items].sort((a, b) => {
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

const ESL_SKILL_COLUMNS = [
  "grammar",
  "vocabulary",
  "speaking",
  "listening",
  "reading",
  "confidence",
  "overall",
] as const;

export type EslEntryRow = {
  id: string;
  recorded_at: string;
  note: string | null;
} & Partial<Record<(typeof ESL_SKILL_COLUMNS)[number], number | null>>;

export function mapEslEntry(row: EslEntryRow): EslMasteryEntry {
  const scores: EslMasteryEntry["scores"] = {};
  for (const column of ESL_SKILL_COLUMNS) {
    const value = row[column];
    // Null means "not observed in this entry", which is different from zero and
    // must not be rendered as a score of 0.
    if (typeof value === "number") scores[column] = value;
  }
  return { id: row.id, recordedAt: row.recorded_at, scores, note: row.note };
}

export type IeltsScoreRow = {
  id: string;
  recorded_at: string;
  skill: string;
  band: number | string;
};

const IELTS_SKILL_LABEL: Record<string, IeltsBandEntry["skill"]> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export function mapIeltsScore(row: IeltsScoreRow): IeltsBandEntry {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    skill: IELTS_SKILL_LABEL[row.skill] ?? "Listening",
    // numeric(2,1) arrives as a string from PostgREST, and `"6.5" < 7` is a
    // string comparison. Coerced once, here.
    band: Number(row.band),
  };
}
