import "server-only";

/**
 * Who is signed in, and what they may see.
 *
 * Every read here goes through the user-scoped client, so Row Level Security
 * applies. The membership query returns nothing for a user who belongs to no
 * workspace — which is the correct answer, not an error to work around.
 *
 * Nothing in this module makes an authorization decision. It reports role so
 * the interface can render the right shell; the boundary itself is in Postgres.
 * A student who somehow reached the teacher shell would still read no teacher
 * data.
 */

import { firstOf } from "@/lib/queries/mappers";
import { createClient } from "@/lib/supabase/server";
import { initialsFrom } from "@/lib/types/auth";
import type { WorkspaceRole, WorkspaceSession } from "@/lib/types/auth";

/**
 * The signed-in user and their active workspace, or null.
 *
 * Null covers three different situations that the interface treats the same
 * way — not configured, not signed in, and signed in with no workspace yet —
 * but `reason` distinguishes them so the shell can say something useful.
 */
export async function getSession(): Promise<WorkspaceSession> {
  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  // getUser() revalidates against the auth server. getSession() would only
  // decode the cookie the client sent, which the client controls.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "signed-out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Teacher";

  // A user may belong to several workspaces eventually. Until a switcher
  // exists, the earliest membership is the active one — deterministic, so the
  // shell does not change between requests.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspace_id, workspaces(name)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      status: "no-workspace",
      userId: user.id,
      email: user.email ?? "",
      displayName,
      initials: initialsFrom(displayName),
    };
  }

  // `firstOf` rather than a cast: PostgREST returns an embed as an object or an
  // array depending on whether it can infer a one-to-one relationship, and
  // guessing wrong here silently renamed every workspace to "Workspace".
  const workspace = firstOf<{ name: string }>(membership.workspaces);

  return {
    status: "active",
    userId: user.id,
    email: user.email ?? "",
    displayName,
    initials: initialsFrom(displayName),
    workspaceId: membership.workspace_id as string,
    workspaceName: workspace?.name ?? "Workspace",
    role: membership.role as WorkspaceRole,
  };
}

/** True when the session belongs to an owner or teacher. */
export function isStaff(session: WorkspaceSession): boolean {
  return (
    session.status === "active" &&
    (session.role === "owner" || session.role === "teacher")
  );
}
