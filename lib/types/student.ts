/**
 * What a learner sees of their own record.
 *
 * A deliberately narrower vocabulary than `lib/types/domain.ts`. The teacher's
 * types describe everything the system knows; these describe only what the
 * learner is allowed to know, and the difference is not cosmetic:
 *
 *   - No lesson plan. `lesson_plans` has no student policy at all — the
 *     teacher's preparation notes are theirs.
 *   - No unreleased feedback or scores. Both carry `released_at`, and the
 *     policies in 0005/0006/0007 require it to be set.
 *   - No other learner, ever.
 *
 * These types cannot enforce any of that; Postgres does. They exist so that a
 * component rendering the portal has no field available to leak in the first
 * place — you cannot accidentally render a teacher's private note through a
 * type that has no room for one.
 */

import type { Track } from "./ui";

/** The learner the signed-in user is. */
export type Learner = {
  studentId: string;
  workspaceId: string;
  fullName: string;
  track: Track;
};

/** A scheduled lesson, as the learner sees it: when, and how long. */
export type StudentLesson = {
  id: string;
  startsAt: string;
  endsAt: string;
  track: Track;
  /** Post-class notes the teacher chose to share. */
  sharedNote: string | null;
};

/**
 * Where a piece of homework stands, from the learner's side.
 *
 * `returned` means feedback exists *and has been released*. Feedback written
 * but held back reads as `submitted` here, which is the honest answer: from the
 * learner's perspective nothing has come back yet.
 */
export type StudentHomeworkState =
  | "todo"
  | "draft"
  | "submitted"
  | "returned";

export type StudentHomework = {
  assignmentId: string;
  /** Null until the learner starts writing. */
  submissionId: string | null;
  title: string;
  instructions: string | null;
  track: Track;
  dueAt: string | null;
  estimatedMinutes: number | null;
  state: StudentHomeworkState;
  /** What the learner has written so far, draft or submitted. */
  body: string;
  /** Only ever populated once released. */
  feedback: string | null;
  feedbackReleasedAt: string | null;
};

/* ------------------------------------------------------------------ */
/* Progress — one shape per track, never a shared "score"              */
/* ------------------------------------------------------------------ */

export type EslMasteryEntry = {
  id: string;
  recordedAt: string;
  /** Percentages, 0–100. Any skill may be absent — it was simply not observed. */
  scores: Partial<
    Record<
      "grammar" | "vocabulary" | "speaking" | "listening" | "reading" | "confidence" | "overall",
      number
    >
  >;
  note: string | null;
};

export type IeltsBandEntry = {
  id: string;
  recordedAt: string;
  skill: "Listening" | "Reading" | "Writing" | "Speaking";
  band: number;
};

/**
 * A discriminated union rather than two optional fields.
 *
 * This is CLAUDE.md rule 5 expressed in the type system: there is no value of
 * this type that carries both a CEFR percentage and a band score, so no
 * component can render them into the same column by accident.
 */
export type StudentProgress =
  | { track: "ESL"; entries: EslMasteryEntry[] }
  | { track: "IELTS"; bands: IeltsBandEntry[] };

/** Everything the portal renders, fetched once per request. */
export type StudentSnapshot = {
  /** Null when the signed-in user is not linked to any learner record. */
  learner: Learner | null;
  lessons: StudentLesson[];
  homework: StudentHomework[];
  progress: StudentProgress;
};

export function emptySnapshot(track: Track = "ESL"): StudentSnapshot {
  return {
    learner: null,
    lessons: [],
    homework: [],
    progress: track === "ESL" ? { track: "ESL", entries: [] } : { track: "IELTS", bands: [] },
  };
}
