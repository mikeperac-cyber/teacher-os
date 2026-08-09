/**
 * Feature 5 — the write path behind the quick actions.
 *
 * Add Student, Plan Lesson, Assign Homework and Record Assessment previously
 * did nothing: the buttons opened a drawer that reported "created successfully"
 * for a write that never happened.
 *
 * They are now wired to real forms with real validation. What is still missing
 * is persistence, and this module is where that gap is made explicit rather
 * than hidden.
 *
 * THE SHAPE IS THE POINT
 * ----------------------
 * `createRecord` has the signature a Next.js server action will have in
 * Phase 3: it takes a typed draft and returns a discriminated result. When
 * Supabase is connected, only the body of this function changes — the forms,
 * their validation and their error states stay exactly as they are.
 *
 * Until then it returns a failure. That is deliberate: a form that silently
 * pretends to save is worse than one that says it cannot, because the teacher
 * loses work and only finds out later.
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

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not-connected" | "invalid"; message: string };

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

/**
 * Persists a record.
 *
 * Phase 3 replaces the body with an authorized Supabase insert. Authorization
 * is enforced by Row Level Security in Postgres, so this function does not — and
 * must not — decide who may write what.
 */
export async function createRecord(draft: RecordDraft): Promise<CreateResult> {
  const errors = validateDraft(draft);
  if (Object.keys(errors).length) {
    return {
      ok: false,
      reason: "invalid",
      message: "Check the highlighted fields.",
    };
  }

  return {
    ok: false,
    reason: "not-connected",
    message: `No database is connected yet, so this ${KIND_LABELS[draft.kind]} cannot be saved. Nothing has been stored.`,
  };
}
