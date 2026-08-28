"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./workflow";

const NOT_CONNECTED = "No database is connected yet.";
function describeError(error: { message: string; code?: string }): string {
  const m = error.message ?? "";
  if (m.includes("row-level security")) return "You do not have permission to do that.";
  return m || "Something went wrong.";
}
async function client() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function upsertIntegration(input: {
  workspaceId: string;
  provider: "google_calendar" | "outlook_calendar" | "google_gmail" | "resend" | "ical";
  config?: Record<string, unknown>;
  status?: "connected" | "disconnected" | "error" | "syncing";
}): Promise<ActionResult<{ integrationId: string }>> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { data, error } = await context.supabase
    .from("integrations")
    .upsert(
      {
        workspace_id: input.workspaceId,
        provider: input.provider,
        config: input.config ?? {},
        status: input.status ?? "connected",
        connected_by: context.userId,
        last_synced_at: input.status === "connected" ? new Date().toISOString() : null,
      },
      { onConflict: "workspace_id,provider" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: describeError(error) };
  revalidatePath("/");
  return { ok: true, data: { integrationId: data.id } };
}

export async function disconnectIntegration(input: { integrationId: string }): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase
    .from("integrations")
    .update({ status: "disconnected", last_error: null })
    .eq("id", input.integrationId);
  if (error) return { ok: false, error: describeError(error) };
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function logIntegrationEvent(input: {
  workspaceId: string;
  integrationId: string;
  kind: "calendar_sync" | "email_sent" | "email_failed" | "calendar_push" | "calendar_pull";
  subject?: string;
  detail?: Record<string, unknown>;
}): Promise<ActionResult> {
  const context = await client();
  if (!context) return { ok: false, error: NOT_CONNECTED };
  const { error } = await context.supabase.from("integration_events").insert({
    workspace_id: input.workspaceId,
    integration_id: input.integrationId,
    kind: input.kind,
    subject: input.subject || null,
    detail: input.detail ?? null,
  });
  if (error) return { ok: false, error: describeError(error) };
  return { ok: true, data: undefined };
}
