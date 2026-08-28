import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MaterialRow = {
  id: string;
  title: string;
  kind: string | null;
  skill: string | null;
  level_label: string | null;
  track: string | null;
  storage_path: string | null;
  use_count: number;
  created_at: string;
};

export type LessonMaterialLink = {
  lessonId: string;
  materialId: string;
  material: MaterialRow;
};

export async function getMaterials(input: { workspaceId: string; track?: "ESL" | "IELTS" | null }): Promise<MaterialRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("materials").select("id, title, kind, skill, level_label, track, storage_path, use_count, created_at").order("created_at", { ascending: false });
  if (input.track) {
    const v = input.track === "ESL" ? "esl" : "ielts";
    query = query.or(`track.eq.${v},track.is.null`);
  }
  const { data } = await query;
  return (data ?? []) as MaterialRow[];
}

export async function getLessonMaterials(lessonId: string): Promise<MaterialRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("lesson_materials")
    .select("material_id, materials ( id, title, kind, skill, level_label, track, storage_path, use_count, created_at )")
    .eq("lesson_id", lessonId);
  if (!data) return [];
  return (data as unknown as { materials: MaterialRow | MaterialRow[] }[]).map((row) => {
    const m = row.materials as unknown as MaterialRow | MaterialRow[];
    return Array.isArray(m) ? m[0] : m;
  }).filter(Boolean);
}

export async function getAssignmentMaterials(assignmentId: string): Promise<MaterialRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("assignment_materials")
    .select("material_id, materials ( id, title, kind, skill, level_label, track, storage_path, use_count, created_at )")
    .eq("assignment_id", assignmentId);
  if (!data) return [];
  return (data as unknown as { materials: MaterialRow | MaterialRow[] }[]).map((row) => {
    const m = row.materials as unknown as MaterialRow | MaterialRow[];
    return Array.isArray(m) ? m[0] : m;
  }).filter(Boolean);
}
