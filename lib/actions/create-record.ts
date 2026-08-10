/**
 * Feature 5 — the write path behind the quick actions.
 *
 * Pure functions only — no writes. Creating a student now goes through
 * `createStudent` in `./workflow.ts`, a real server action subject to Row Level
 * Security. This module keeps the client-side validation, which runs before the
 * round trip so a missing field is reported instantly.
 *
 * Client-side validation is a convenience and never a control: the same rules
 * are enforced again by the action and by database constraints.
 */

import type { Track } from "@/lib/types/ui";

export type RecordKind = "student" | "lesson" | "homework" | "assessment";

export type RecordDraft = {
  kind: RecordKind;
  track: Track;
  title: string;
  /** Second required field; its meaning depends on `kind`. */
  subject: string;
  note?: string;
};


/** Field-level validation errors, keyed by field name. */
export type FieldErrors = Partial<Record<"title" | "subject", string>>;

/** What the second field means for each record kind. */
export const SUBJECT_LABELS: Record<RecordKind, Record<Track, string>> = {
  student: {
    ESL: "CEFR level and learning goal",
    IELTS: "Current band and target band",
  },
  lesson: {
    ESL: "Communicative outcome",
    IELTS: "Band objective or rubric gap",
  },
  homework: {
    ESL: "Practice type and student",
    IELTS: "Task type and student",
  },
  assessment: {
    ESL: "Progress check type and student",
    IELTS: "Mock or section and student",
  },
};

export const KIND_LABELS: Record<RecordKind, string> = {
  student: "student",
  lesson: "lesson",
  homework: "homework",
  assessment: "assessment",
};

/**
 * Validates a draft before any write is attempted.
 *
 * Runs unchanged on the client for immediate feedback and on the server in
 * Phase 3, because client-side validation is a convenience and never a control.
 */
export function validateDraft(draft: RecordDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.title.trim()) {
    errors.title = "Give this a clear name.";
  } else if (draft.title.trim().length < 2) {
    errors.title = "That is too short to identify later.";
  }
  if (!draft.subject.trim()) {
    errors.subject = `Required — ${SUBJECT_LABELS[draft.kind][draft.track].toLowerCase()}.`;
  }
  return errors;
}
