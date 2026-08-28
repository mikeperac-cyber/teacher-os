"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./workflow";

const NOT_CONNECTED = "No database is connected yet, so nothing can be saved. See docs/SUPABASE_SETUP.md.";

function describeError(error: { message: string; code?: string }): string {
  const m = error.message ?? "";
  if (m.includes("row-level security") || m.includes("violates row-level security policy")) return "You do not have permission to do that.";
  if (error.code === "23505") return "Already attached.";
  return m || "Something went wrong.";
}

async function client() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function attachMaterialToLesson(input: {
  workspaceId: string;
  lessonId: string;
  materialId: string;
}): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase.from("lesson_materials").insert({
    workspace_id: input.workspaceId,
    lesson_id: input.lessonId,
    material_id: input.materialId,
    added_by: context.userId,
  });
  if (error) return { ok: false, error: describeError(error) };
  // bump use_count — best effort
  try {
    await context.supabase.rpc("increment_material_use", { p_material_id: input.materialId });
  } catch {}
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function detachMaterialFromLesson(input: { lessonId: string; materialId: string }): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase
    .from("lesson_materials")
    .delete()
    .eq("lesson_id", input.lessonId)
    .eq("material_id", input.materialId);
  if (error) return { ok: false, error: describeError(error) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function attachMaterialToAssignment(input: {
  workspaceId: string;
  assignmentId: string;
  materialId: string;
}): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase.from("assignment_materials").insert({
    workspace_id: input.workspaceId,
    assignment_id: input.assignmentId,
    material_id: input.materialId,
    added_by: context.userId,
  });
  if (error) return { ok: false, error: describeError(error) };
  try {
    await context.supabase.rpc("increment_material_use", { p_material_id: input.materialId });
  } catch {}
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function detachMaterialFromAssignment(input: { assignmentId: string; materialId: string }): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase
    .from("assignment_materials")
    .delete()
    .eq("assignment_id", input.assignmentId)
    .eq("material_id", input.materialId);
  if (error) return { ok: false, error: describeError(error) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}
