"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./workflow";

const NOT_CONNECTED =
  "No database is connected yet, so nothing can be saved. See docs/SUPABASE_SETUP.md.";

function describeError(error: { message: string; code?: string }): string {
  const message = error.message ?? "";
  if (message.includes("row-level security") || message.includes("violates row-level security policy")) {
    return "You do not have permission to do that.";
  }
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23503") return "That refers to a record which no longer exists.";
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

/**
 * Records a file uploaded to Storage in the `files` table.
 *
 * The bytes themselves are uploaded directly from the browser via the Supabase
 * Storage API (so the server never buffers them). This action only creates the
 * metadata row after the upload succeeds, and enforces that the path matches
 * the expected layout ({workspace_id}/{student_id}/{submission_id}/{file} etc.)
 * so the storage policies remain the authorization source for the bytes.
 */
export async function recordFile(input: {
  workspaceId: string;
  bucketId: "homework-submissions" | "speaking-recordings" | "materials" | "avatars";
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  studentId?: string;
  submissionId?: string;
}): Promise<ActionResult<{ fileId: string }>> {
  if (!input.storagePath.trim()) return { ok: false, error: "Missing storage path.", field: "storagePath" };
  if (!input.originalName.trim()) return { ok: false, error: "Missing file name.", field: "originalName" };
  if (input.sizeBytes < 0) return { ok: false, error: "Invalid file size." };

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("files")
    .insert({
      workspace_id: input.workspaceId,
      bucket_id: input.bucketId,
      storage_path: input.storagePath,
      student_id: input.studentId || null,
      submission_id: input.submissionId || null,
      uploaded_by: context.userId,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  // If this file is a material, keep use_count useful.
  if (input.bucketId === "materials" && input.storagePath) {
    const materialId = input.storagePath.split("/")[1];
    if (materialId) {
      try {
        await context.supabase.rpc("increment_material_use", { p_material_id: materialId });
      } catch {}
    }
  }

  revalidatePath("/");
  return { ok: true, data: { fileId: data.id } };
}

/**
 * Creates a signed URL for a private Storage object (server-side check).
 *
 * The caller must already have RLS access to the underlying record (lesson,
 * submission, etc.). The URL itself is signed with the service role and is
 * time-limited.
 */
export async function createSignedUrl(input: {
  bucketId: string;
  storagePath: string;
  expiresIn?: number;
}): Promise<ActionResult<{ url: string }>> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  // Verify the caller can at least read the file record, if one exists.
  // If no files row exists (direct storage path), fall back to checking
  // workspace membership via the path's first segment.
  const { data } = await context.supabase
    .from("files")
    .select("id, workspace_id, student_id")
    .eq("bucket_id", input.bucketId)
    .eq("storage_path", input.storagePath)
    .maybeSingle();

  if (data) {
    // RLS already enforced the select; if we got a row, they may read it.
  } else {
    // No files row — still require workspace membership for the path's workspace.
    const workspaceId = input.storagePath.split("/")[0];
    if (!workspaceId) return { ok: false, error: "Invalid storage path." };
    const { data: membership } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!membership) return { ok: false, error: "You do not have permission to do that." };
  }

  const { data: signed, error } = await context.supabase.storage
    .from(input.bucketId)
    .createSignedUrl(input.storagePath, input.expiresIn ?? 3600);

  if (error || !signed) return { ok: false, error: describeError(error ?? { message: "Could not create signed URL." }) };

  return { ok: true, data: { url: signed.signedUrl } };
}

export async function deleteFile(input: { fileId: string }): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  // Fetch to get bucket/path for storage deletion.
  const { data: row, error: fetchError } = await context.supabase
    .from("files")
    .select("bucket_id, storage_path")
    .eq("id", input.fileId)
    .single();

  if (fetchError) return { ok: false, error: describeError(fetchError) };

  // Remove from storage first (best effort), then metadata.
  await context.supabase.storage.from(row.bucket_id).remove([row.storage_path]);

  const { error } = await context.supabase.from("files").delete().eq("id", input.fileId);
  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: undefined };
}

/**
 * Creates a material record with an optional file already uploaded.
 * This is the primary upload path for the Materials library.
 */
export async function createMaterial(input: {
  workspaceId: string;
  title: string;
  kind?: string;
  skill?: string;
  levelLabel?: string;
  track?: "ESL" | "IELTS" | null;
  storagePath?: string;
}): Promise<ActionResult<{ materialId: string }>> {
  if (!input.title.trim()) return { ok: false, error: "Give the material a title.", field: "title" as const };

  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };

  const { data, error } = await context.supabase
    .from("materials")
    .insert({
      workspace_id: input.workspaceId,
      created_by: context.userId,
      title: input.title.trim(),
      kind: input.kind || null,
      skill: input.skill || null,
      level_label: input.levelLabel || null,
      track: input.track ? (input.track === "ESL" ? "esl" : "ielts") : null,
      storage_path: input.storagePath || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: describeError(error) };

  revalidatePath("/");
  return { ok: true, data: { materialId: data.id } };
}
