"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./workflow";

const NOT_CONNECTED = "No database is connected yet, so nothing can be saved. See docs/SUPABASE_SETUP.md.";

function describeError(error: { message: string; code?: string }): string {
  const m = error.message ?? "";
  if (m.includes("row-level security") || m.includes("violates row-level security policy")) return "You do not have permission to do that.";
  if (error.code === "23505") return "That already exists.";
  if (m.includes("band_score")) return "Bands must be between 0 and 9, in half-band steps.";
  return m || "Something went wrong.";
}

async function client() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

/** Ensures default rubric templates exist for this workspace (idempotent). */
export async function ensureDefaultTemplates(workspaceId: string): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase.rpc("ensure_default_rubric_templates", { p_workspace_id: workspaceId });
  if (error) return { ok: false, error: describeError(error) };
  return { ok: true, data: undefined };
}

export async function createRubricTemplate(input: {
  workspaceId: string;
  track: "ESL" | "IELTS";
  title: string;
  kind: "esl_progress_check" | "ielts_writing" | "ielts_speaking" | "ielts_mock" | "custom";
  criteria: { label: string; maxScore?: number }[];
  description?: string;
}): Promise<ActionResult<{ templateId: string }>> {
  if (!input.title.trim()) return { ok: false, error: "Give the rubric a title.", field: "title" };
  if (input.criteria.length === 0) return { ok: false, error: "Add at least one criterion." };
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data: template, error: tError } = await context.supabase
    .from("rubric_templates")
    .insert({
      workspace_id: input.workspaceId,
      track: input.track === "ESL" ? "esl" : "ielts",
      title: input.title.trim(),
      kind: input.kind,
      description: input.description || null,
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (tError) return { ok: false, error: describeError(tError) };

  const rows = input.criteria.map((c, idx) => ({
    template_id: template.id,
    workspace_id: input.workspaceId,
    label: c.label.trim(),
    sort_order: idx + 1,
    max_score: c.maxScore ?? (input.track === "ESL" ? 100 : 9),
  }));

  const { error: cError } = await context.supabase.from("rubric_criteria").insert(rows);
  if (cError) return { ok: false, error: describeError(cError) };

  revalidatePath("/");
  return { ok: true, data: { templateId: template.id } };
}

export async function recordAssessment(input: {
  workspaceId: string;
  studentId: string;
  track: "ESL" | "IELTS";
  title: string;
  kind?: string;
  templateId?: string;
  dueAt?: string;
  blocksLessonId?: string;
  scores: { criterionId: string; score?: number; band?: number; comment?: string }[];
  release?: boolean;
}): Promise<ActionResult<{ assessmentId: string }>> {
  if (!input.title.trim()) return { ok: false, error: "Give the assessment a title.", field: "title" };
  if (input.scores.length === 0) return { ok: false, error: "Score at least one criterion." };

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  // Ensure workspace has defaults if no template supplied
  if (!input.templateId) {
    await context.supabase.rpc("ensure_default_rubric_templates", { p_workspace_id: input.workspaceId });
  }

  const { data: assessment, error: aError } = await context.supabase
    .from("assessments")
    .insert({
      workspace_id: input.workspaceId,
      student_id: input.studentId,
      track: input.track === "ESL" ? "esl" : "ielts",
      template_id: input.templateId || null,
      title: input.title.trim(),
      kind: (input.kind as string) || "custom",
      status: input.release ? "returned" : "scored",
      due_at: input.dueAt || null,
      blocks_lesson_id: input.blocksLessonId || null,
      scheduled_by: context.userId,
      released_at: input.release ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (aError) return { ok: false, error: describeError(aError) };

  const scoreRows = input.scores.map((s) => ({
    workspace_id: input.workspaceId,
    assessment_id: assessment.id,
    criterion_id: s.criterionId,
    score: s.score ?? null,
    band: s.band ?? null,
    comment: s.comment || null,
  }));

  const { error: sError } = await context.supabase.from("assessment_scores").insert(scoreRows);
  if (sError) {
    // Roll back assessment if scores fail — best effort delete
    await context.supabase.from("assessments").delete().eq("id", assessment.id);
    return { ok: false, error: describeError(sError) };
  }

  revalidatePath("/");
  return { ok: true, data: { assessmentId: assessment.id } };
}

export async function releaseAssessment(input: { assessmentId: string }): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase
    .from("assessments")
    .update({ released_at: new Date().toISOString(), status: "returned" })
    .eq("id", input.assessmentId);
  if (error) return { ok: false, error: describeError(error) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function updateAssessmentScores(input: {
  assessmentId: string;
  scores: { criterionId: string; score?: number; band?: number; comment?: string }[];
}): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  for (const s of input.scores) {
    const { error } = await context.supabase
      .from("assessment_scores")
      .upsert(
        {
          assessment_id: input.assessmentId,
          criterion_id: s.criterionId,
          score: s.score ?? null,
          band: s.band ?? null,
          comment: s.comment || null,
          workspace_id: (await context.supabase.from("assessments").select("workspace_id").eq("id", input.assessmentId).single()).data?.workspace_id,
        },
        { onConflict: "assessment_id,criterion_id" },
      );
    if (error) return { ok: false, error: describeError(error) };
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}
