"use client";

/**
 * Onboarding for a signed-in user who belongs to no workspace.
 *
 * This screen used to be a dead end — it explained that an owner needed to
 * invite you and offered a link back to sign in. For someone setting the
 * product up for themselves, that was the end of the road: the database refused
 * both halves of creating a workspace, so there was no way forward at all
 * (see supabase/migrations/0011_create_workspace.sql).
 */

import { useState } from "react";
import { AlertCircle, Loader2, Plus, UserRound } from "lucide-react";

import { createWorkspace } from "@/lib/actions/workflow";

export function CreateWorkspace({ displayName }: { displayName: string }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setStatus("failed");
      setMessage("Give your workspace a name.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await createWorkspace(name);

    if (result.ok) {
      // The action revalidates the layout, so the shell re-resolves the session
      // and this screen is replaced by the workspace.
      return;
    }

    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <div className="no-workspace-card">
      <span className="no-workspace-icon">
        <UserRound size={21} />
      </span>
      <h1>Welcome, {displayName}</h1>
      <p>
        You are signed in but have no workspace yet. Create one to start adding
        learners — or wait to be invited, if someone else runs the teaching
        business.
      </p>

      <form className="create-workspace-form" onSubmit={submit} noValidate>
        <label>
          <span>Workspace name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My teaching"
            autoFocus
          />
        </label>

        {status === "failed" && message && (
          <p className="create-modal-error" role="alert">
            <AlertCircle size={15} />
            <span>{message}</span>
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={status === "saving"}
        >
          {status === "saving" ? (
            <>
              <Loader2 size={15} className="spin" /> Creating…
            </>
          ) : (
            <>
              <Plus size={15} /> Create workspace
            </>
          )}
        </button>
      </form>
    </div>
  );
}
