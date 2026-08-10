/**
 * The workspace route.
 *
 * A server component, so the signed-in identity is resolved on the server and
 * handed to the client shell as a prop. The browser is never asked who the user
 * is — which matters, because anything the browser answers is something a user
 * can change.
 *
 * This is also where the role-aware split lives: an owner or teacher gets the
 * teaching workspace, and a student gets their own. Note that this is a
 * *rendering* decision, not a security one. A student who reached the teacher
 * shell would still read no teacher data, because Row Level Security refuses it
 * in Postgres (see tests/db/rls.test.ts).
 */

import { UserRound } from "lucide-react";
import Link from "next/link";

import { Workspace } from "@/components/workspace/Workspace";
import { getSession } from "@/lib/auth/session";
import { getTriageData } from "@/lib/queries/triage";
import { shellUserFrom } from "@/lib/types/auth";

export default async function WorkspacePage() {
  const session = await getSession();

  /**
   * One clock for the whole render.
   *
   * Captured here and passed down as an ISO string so every relative label —
   * "in 48 min", "overdue by 2 days" — is computed from the same instant on the
   * server and again on hydration. A client-side clock produced a hydration
   * mismatch, which is what the old `useNow` hook existed to work around.
   */
  const now = new Date();

  // Signed in, but belonging to no workspace. Every policy is scoped by
  // membership, so this user would see an entirely empty application with no
  // explanation. Say why instead.
  if (session.status === "no-workspace") {
    return (
      <div className="no-workspace-shell">
        <div className="no-workspace-card">
          <span className="no-workspace-icon">
            <UserRound size={21} />
          </span>
          <h1>You are not in a workspace yet</h1>
          <p>
            Your account exists, but it has not been added to a teaching
            workspace. An owner needs to invite you before there is anything to
            see.
          </p>
          <p>
            Setting this up for the first time? <code>docs/SUPABASE_SETUP.md</code>{" "}
            covers creating the first workspace.
          </p>
          <Link className="primary-button" href="/sign-in">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Fetched with the user-scoped client, so Row Level Security decides what is
  // in here. An unconfigured or signed-out request gets empty collections and
  // the same empty states the fixtures produced.
  const triage = await getTriageData(now);

  return (
    <Workspace
      shellUser={shellUserFrom(session)}
      workspaceId={session.status === "active" ? session.workspaceId : null}
      triage={triage}
      nowIso={now.toISOString()}
    />
  );
}
