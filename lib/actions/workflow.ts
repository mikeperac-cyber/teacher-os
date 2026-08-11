"use server";

/**
 * The teaching workflow, as writes.
 *
 * One action per step of the vertical slice in CLAUDE.md:
 *
 *   create student → schedule lesson → prepare lesson → assign homework
 *   → student submits → teacher gives feedback → progress update
 *
 * AUTHORIZATION IS NOT HERE
 * -------------------------
 * None of these functions checks whether the caller is allowed to act. That is
 * deliberate. Every write goes through the user-scoped client, so Row Level
 * Security decides, and the policies are tested in `tests/db/`. A second check
 * in application code would be a weaker copy of a rule Postgres already
 * enforces, and the two would drift.
 *
 * What these functions do own is *validation* — that a band is a real band,
 * that a lesson ends after it starts — because a database constraint produces a
 * correct rejection but a useless message.
 */

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { toTrackValue } from "@/lib/types/database";
import type { Track } from "@/lib/types/ui";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

const NOT_CONNECTED =
  "No database is connected yet, so nothing can be saved. See docs/SUPABASE_SETUP.md.";

/** Denials from Postgres read like internals; this makes them mean something. */
function describeError(error: { message: string; code?: string }): string {
  const message = error.message ?? "";

  if (
    message.includes("row-level security") ||
    message.includes("violates row-level security policy")
  ) {
    return "You do not have permission to do that.";
  }
  if (error.code === "23505") {
    return "That already exists.";
  }
  if (error.code === "23503") {
    return "That refers to a record which no longer exists.";
  }
  if (message.includes("band_score")) {
    return "Bands must be between 0 and 9, in half-band steps.";
  }
  return message || "Something went wrong.";
}

async function client() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

/* ------------------------------------------------------------------ */
/* 1. Create a student                                                 */
/* ------------------------------------------------------------------ */

export async function createStudent(input: {
  workspaceId: string;
  track: Track;
  fullName: string;
  /** ESL: target CEFR level. IELTS: target band. */
  target?: string;
  testDate?: string;
}): Promise<ActionResult<{ studentId: string }>> {
  if (!input.fullName.trim()) {
    return { ok: false, error: "Give the learner a name.", field: "fullName" };
  }

  // Validated before the round trip so the message names the field, but the
  // database enforces the same range through the band_score domain.
  if (input.track === "IELTS" && input.target) {
    const targetBand = Number(input.target);
    if (
      Number.isNaN(targetBand) ||
      targetBand < 0 ||
      targetBand > 9 ||
      (targetBand * 2) % 1 !== 0
    ) {
      return {
        ok: false,
        error: "Target band must be between 0 and 9, in half-band steps.",
        field: "target",
      };
    }
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  // A single call, because the learner and their track profile must land
  // together or not at all. See supabase/migrations/0010_create_student.sql —
  // two client calls cannot share a transaction, and a learner with no profile
  // is a broken record nothing surfaces.
  const { data, error } = await context.supabase.rpc("create_student", {
    p_workspace_id: input.workspaceId,
    p_track: toTrackValue(input.track),
    p_full_name: input.fullName.trim(),
    p_target: input.target ?? null,
    p_test_date: input.testDate || null,
  });

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { studentId: data as string } };
}

/* ------------------------------------------------------------------ */
/* 2. Schedule a lesson                                                */
/* ------------------------------------------------------------------ */

export async function scheduleLesson(input: {
  workspaceId: string;
  studentId: string;
  track: Track;
  startsAt: string;
  endsAt: string;
  title?: string;
}): Promise<ActionResult<{ lessonId: string }>> {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Enter a valid start and end time.", field: "startsAt" };
  }
  // The database enforces this too; catching it here produces a message a
  // teacher can act on rather than a constraint name.
  if (end <= start) {
    return { ok: false, error: "The lesson must end after it starts.", field: "endsAt" };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("lessons")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      track: toTrackValue(input.track),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      title: input.title || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { lessonId: data.id as string } };
}

/* ------------------------------------------------------------------ */
/* 3. Prepare the lesson                                               */
/* ------------------------------------------------------------------ */

export async function saveLessonPlan(input: {
  workspaceId: string;
  lessonId: string;
  studentId: string;
  track: Track;
  /** ESL: the communicative outcome. IELTS: the band objective. */
  objective: string;
  focus?: string;
  teacherNote?: string;
  blocks?: { time: string; title: string; detail: string; tone: string }[];
  markReady?: boolean;
}): Promise<ActionResult<{ planId: string }>> {
  if (!input.objective.trim()) {
    return {
      ok: false,
      error:
        input.track === "ESL"
          ? "Set a communicative outcome for this lesson."
          : "Set a band objective for this lesson.",
      field: "objective",
    };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  // One plan per lesson (unique constraint), so re-saving updates rather than
  // creating a second.
  const { data, error } = await context.supabase
    .from("lesson_plans")
    .upsert(
      {
        workspace_id: input.workspaceId,
        lesson_id: input.lessonId,
        student_id: input.studentId,
        track: toTrackValue(input.track),
        objective: input.objective.trim(),
        focus: input.focus || null,
        teacher_note: input.teacherNote || null,
        blocks: input.blocks ?? [],
        marked_ready_at: input.markReady ? new Date().toISOString() : null,
      },
      { onConflict: "lesson_id" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { planId: data.id as string } };
}

/* ------------------------------------------------------------------ */
/* 4. Assign homework                                                  */
/* ------------------------------------------------------------------ */

export async function assignHomework(input: {
  workspaceId: string;
  studentId: string;
  track: Track;
  title: string;
  instructions?: string;
  dueAt?: string;
  estimatedMinutes?: number;
  lessonId?: string;
  /** The lesson this must be returned before — drives inbox blocker ranking. */
  blocksLessonId?: string;
}): Promise<ActionResult<{ assignmentId: string }>> {
  if (!input.title.trim()) {
    return { ok: false, error: "Give the assignment a title.", field: "title" };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("homework_assignments")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      track: toTrackValue(input.track),
      title: input.title.trim(),
      instructions: input.instructions || null,
      due_at: input.dueAt || null,
      estimated_minutes: input.estimatedMinutes ?? null,
      lesson_id: input.lessonId || null,
      blocks_lesson_id: input.blocksLessonId || null,
      // The policy requires this to be the caller; setting it here means the
      // caller cannot attribute an assignment to someone else.
      assigned_by: context.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { assignmentId: data.id as string } };
}

/* ------------------------------------------------------------------ */
/* 5. Student submits                                                  */
/* ------------------------------------------------------------------ */

/**
 * Called by the student.
 *
 * `submitted_at` is not set here: a trigger stamps it from the status
 * transition, so the time cannot be back-dated by whoever sends the request.
 */
export async function submitHomework(input: {
  workspaceId: string;
  assignmentId: string;
  studentId: string;
  body: string;
  /** False saves a draft the student can still edit. */
  submit: boolean;
}): Promise<ActionResult<{ submissionId: string }>> {
  if (input.submit && !input.body.trim()) {
    return { ok: false, error: "Write something before submitting.", field: "body" };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("homework_submissions")
    .upsert(
      {
        workspace_id: input.workspaceId,
        assignment_id: input.assignmentId,
        student_id: input.studentId,
        body: input.body,
        status: input.submit ? "submitted" : "draft",
      },
      { onConflict: "assignment_id" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { submissionId: data.id as string } };
}

/* ------------------------------------------------------------------ */
/* 6. Teacher records feedback                                         */
/* ------------------------------------------------------------------ */

/**
 * `release` is separate from writing the feedback on purpose.
 *
 * A teacher can save a first pass, come back, and only then release it. The
 * student sees nothing until `released_at` is set — the policy in
 * `0005_homework.sql` requires it.
 */
export async function recordFeedback(input: {
  workspaceId: string;
  submissionId: string;
  studentId: string;
  body: string;
  release: boolean;
}): Promise<ActionResult<{ feedbackId: string }>> {
  if (!input.body.trim()) {
    return { ok: false, error: "Write the feedback first.", field: "body" };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { supabase, userId } = context;

  const { data, error } = await supabase
    .from("homework_feedback")
    .upsert(
      {
        workspace_id: input.workspaceId,
        submission_id: input.submissionId,
        student_id: input.studentId,
        author_id: userId,
        body: input.body.trim(),
        released_at: input.release ? new Date().toISOString() : null,
      },
      { onConflict: "submission_id" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  // Returning the work closes the loop the homework board shows.
  //
  // Reported rather than ignored: if this fails, the learner can see their
  // feedback while the board still shows the work as outstanding, and the
  // teacher would keep marking something already marked.
  if (input.release) {
    const { error: returnError } = await supabase
      .from("homework_submissions")
      .update({ status: "returned" })
      .eq("id", input.submissionId);

    if (returnError) {
      return {
        ok: false,
        error: `Feedback was saved and released, but the homework could not be marked returned: ${describeError(returnError)}`,
      };
    }
  }

  revalidatePath("/");
  return { ok: true, data: { feedbackId: data.id as string } };
}

/* ------------------------------------------------------------------ */
/* 7. Progress update — one per track, never merged                    */
/* ------------------------------------------------------------------ */

/**
 * ESL: CEFR mastery percentages.
 *
 * Separate from the IELTS function below and must stay that way (CLAUDE.md
 * rule 5). A single `recordProgress` taking a generic score is exactly the
 * regression the rule exists to prevent.
 */
export async function recordEslProgress(input: {
  workspaceId: string;
  studentId: string;
  lessonId?: string;
  scores: {
    grammar?: number;
    vocabulary?: number;
    speaking?: number;
    listening?: number;
    reading?: number;
    confidence?: number;
    overall?: number;
  };
  note?: string;
  release: boolean;
}): Promise<ActionResult<{ entryId: string }>> {
  const values = Object.values(input.scores).filter(
    (value): value is number => value !== undefined,
  );
  if (values.length === 0) {
    return { ok: false, error: "Record at least one score.", field: "scores" };
  }
  if (values.some((value) => value < 0 || value > 100)) {
    return {
      ok: false,
      error: "CEFR mastery is a percentage between 0 and 100.",
      field: "scores",
    };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("esl_progress_entries")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      lesson_id: input.lessonId || null,
      recorded_by: context.userId,
      ...input.scores,
      note: input.note || null,
      released_at: input.release ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { entryId: data.id as string } };
}

/** IELTS: band scores against the official scale. */
export async function recordIeltsBands(input: {
  workspaceId: string;
  studentId: string;
  bands: Partial<Record<"listening" | "reading" | "writing" | "speaking", number>>;
  release: boolean;
}): Promise<ActionResult<{ recorded: number }>> {
  const entries = Object.entries(input.bands).filter(
    ([, band]) => band !== undefined,
  ) as [string, number][];

  if (entries.length === 0) {
    return { ok: false, error: "Record at least one band.", field: "bands" };
  }

  // Checked here as well as by the band_score domain, so the teacher gets a
  // sentence rather than a constraint violation.
  for (const [skill, band] of entries) {
    if (band < 0 || band > 9 || (band * 2) % 1 !== 0) {
      return {
        ok: false,
        error: `${skill} must be a band between 0 and 9, in half-band steps.`,
        field: "bands",
      };
    }
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const releasedAt = input.release ? new Date().toISOString() : null;

  const { error } = await context.supabase.from("ielts_skill_scores").insert(
    entries.map(([skill, band]) => ({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      skill,
      band,
      recorded_by: context.userId,
      released_at: releasedAt,
    })),
  );

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { recorded: entries.length } };
}

/* ------------------------------------------------------------------ */
/* 0. Workspace bootstrap                                              */
/* ------------------------------------------------------------------ */

/**
 * Creates the caller's first workspace and makes them its owner.
 *
 * Goes through `public.create_workspace` because the two rows must land
 * together, and because a signed-in user with no membership cannot write either
 * of them directly — see supabase/migrations/0011_create_workspace.sql for why
 * that deadlock existed.
 */
export async function createWorkspace(
  name: string,
): Promise<ActionResult<{ workspaceId: string }>> {
  if (!name.trim()) {
    return { ok: false, error: "Give your workspace a name.", field: "name" };
  }

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase.rpc("create_workspace", {
    p_name: name.trim(),
  });

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { workspaceId: data as string } };
}
