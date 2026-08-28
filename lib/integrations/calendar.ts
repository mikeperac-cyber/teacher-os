/**
 * Calendar integration — scaffolding for Google Calendar / Outlook / iCal.
 *
 * Server-only. Real provider calls are behind env gates so the feature is
 * testable without credentials.
 *
 * Current behavior:
 *  - Provides a local calendar query (`getCalendarEvents`) that reads the app's
 *    own `calendar_events` + `lessons` tables (already synced).
 *  - Provides `pushToProvider` / `pullFromProvider` stubs that log and record
 *    an `integration_events` row when a workspace has a `connected` integration.
 *    Replace the stub bodies with real Google Calendar API calls when a client ID
 *    and Supabase Vault secret are provisioned.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CalendarSource = "local" | "google" | "outlook" | "ical";

export type ProviderResult = { ok: true; synced: number } | { ok: false; error: string; dryRun?: boolean };

/** Reads the workspace's calendar events (local truth), regardless of provider. */
export async function getCalendarEvents(input: { workspaceId: string; from: string; to: string }) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("calendar_events")
    .select("id, title, kind, starts_at, ends_at, sync_status, integration_id")
    .eq("workspace_id", input.workspaceId)
    .gte("starts_at", input.from)
    .lte("ends_at", input.to)
    .order("starts_at", { ascending: true });
  return data ?? [];
}

/** Stub: push local events to the external provider. */
export async function pushToProvider(input: { workspaceId: string; provider: string }): Promise<ProviderResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "No database." };
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, provider, status")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .maybeSingle();

  if (!integration || integration.status !== "connected") {
    console.info(`[calendar:dry-run] push ${input.provider} in ${input.workspaceId} — not connected`);
    return { ok: true, synced: 0 };
  }

  // TODO: call Google Calendar API with Vault secret when provisioned.
  console.info(`[calendar] push ${input.provider} workspace=${input.workspaceId} (stub)`);

  await supabase.from("integration_events").insert({
    workspace_id: input.workspaceId,
    integration_id: integration.id,
    kind: "calendar_push",
    subject: `Pushed to ${input.provider}`,
    detail: { at: new Date().toISOString() },
  });

  await supabase.from("integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id);

  return { ok: true, synced: 0 };
}

/** Stub: pull external events into the local calendar. */
export async function pullFromProvider(input: { workspaceId: string; provider: string }): Promise<ProviderResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "No database." };
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, provider, status")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .maybeSingle();

  if (!integration || integration.status !== "connected") {
    return { ok: true, synced: 0 };
  }

  console.info(`[calendar] pull ${input.provider} workspace=${input.workspaceId} (stub)`);

  await supabase.from("integration_events").insert({
    workspace_id: input.workspaceId,
    integration_id: integration.id,
    kind: "calendar_pull",
    subject: `Pulled from ${input.provider}`,
    detail: { at: new Date().toISOString() },
  });

  return { ok: true, synced: 0 };
}

/** Builds an iCal feed string for a set of events (for the /api/calendar/ical route). */
export function buildIcalFeed(input: { events: { title: string; starts_at: string; ends_at: string; id: string }[]; calendarName: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Teacher OS//EN",
    `X-WR-CALNAME:${input.calendarName}`,
  ];
  for (const ev of input.events) {
    const start = new Date(ev.starts_at).toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
    const end = new Date(ev.ends_at).toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@teacher-os`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${ev.title.replace(/[\n,;]/g, " ")}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
