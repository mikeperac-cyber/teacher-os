import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RubricTemplateRow = {
  id: string;
  workspace_id: string;
  track: string;
  title: string;
  kind: string;
  description: string | null;
  created_by: string;
};

export type RubricCriterionRow = {
  id: string;
  template_id: string;
  workspace_id: string;
  label: string;
  sort_order: number;
  max_score: number | null;
};

export type AssessmentRow = {
  id: string;
  workspace_id: string;
  student_id: string;
  track: string;
  template_id: string | null;
  title: string;
  kind: string;
  status: string;
  due_at: string | null;
  blocks_lesson_id: string | null;
  released_at: string | null;
  created_at: string;
};

export type AssessmentWithScores = AssessmentRow & {
  rubric_criteria?: RubricCriterionRow[]; // via template
  assessment_scores?: { criterion_id: string; score: number | null; band: number | null; comment: string | null }[];
  students?: { full_name: string };
};

export async function getRubricTemplates(workspaceId: string, track?: "ESL" | "IELTS"): Promise<(RubricTemplateRow & { rubric_criteria: RubricCriterionRow[] })[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("rubric_templates").select("id, workspace_id, track, title, kind, description, created_by, rubric_criteria ( id, template_id, workspace_id, label, sort_order, max_score )").eq("workspace_id", workspaceId).order("created_at", { ascending: true });
  if (track) query = query.eq("track", track === "ESL" ? "esl" : "ielts");
  const { data } = await query;
  const rows = (data ?? []) as unknown as (RubricTemplateRow & { rubric_criteria: RubricCriterionRow[] })[];
  for (const r of rows) r.rubric_criteria = (r.rubric_criteria ?? []).sort((a, b) => a.sort_order - b.sort_order);
  return rows;
}

export async function getAssessments(input: { workspaceId: string; track?: "ESL" | "IELTS"; status?: string[] }): Promise<AssessmentWithScores[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("assessments")
    .select("id, workspace_id, student_id, track, template_id, title, kind, status, due_at, blocks_lesson_id, released_at, created_at, students ( full_name ), assessment_scores ( criterion_id, score, band, comment )")
    .eq("workspace_id", input.workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (input.track) query = query.eq("track", input.track === "ESL" ? "esl" : "ielts");
  if (input.status?.length) query = query.in("status", input.status);
  const { data } = await query;
  return (data ?? []) as unknown as AssessmentWithScores[];
}

export async function getPendingAssessmentsForInbox(workspaceId: string): Promise<AssessmentWithScores[]> {
  return getAssessments({ workspaceId, status: ["submitted", "scored"] });
}
