"use client";

/**
 * Giving a learner access to their own records.
 *
 * The sequence is deliberately two-sided and cannot be collapsed into one step:
 * the learner signs up themselves, then the owner links that address. The
 * alternative — the teacher creating an account on the learner's behalf — means
 * the teacher choosing someone else's password, which is not a thing this
 * application will do.
 *
 * That is also why the failure "no account uses that email address yet" is
 * worded as an instruction rather than an error. It is the expected first
 * outcome, not a mistake.
 */

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import {
  linkStudentAccount,
  unlinkStudentAccount,
} from "@/lib/actions/workflow";
import type { StudentSignal } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

export function LearnerAccess({
  track,
  students,
}: {
  track: Track;
  students: StudentSignal[];
}) {
  const learners = students.filter((student) => student.track === track);

  if (learners.length === 0) {
    return (
      <article className="panel">
        <PanelHeader kicker="Portal access" title="Learner logins" />
        <EmptyState
          icon={KeyRound}
          title={track === "ESL" ? "No ESL learners yet" : "No IELTS candidates yet"}
          hint="Once a learner exists, you can connect their own login here."
        />
      </article>
    );
  }

  return (
    <article className="panel">
      <PanelHeader
        kicker="Portal access"
        title="Learner logins"
        action={
          <span className="draft-label">
            {learners.filter((l) => l.hasLogin).length} of {learners.length} connected
          </span>
        }
      />
      <div className="access-list">
        {learners.map((learner) => (
          <AccessRow key={learner.studentId} learner={learner} />
        ))}
      </div>
    </article>
  );
}

function AccessRow({ learner }: { learner: StudentSignal }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const grant = async () => {
    setStatus("working");
    setMessage(null);
    const result = await linkStudentAccount({
      studentId: learner.studentId,
      email,
    });
    if (result.ok) {
      setStatus("done");
      setMessage(`${learner.name} can now sign in with ${email.trim()}.`);
      setEmail("");
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  const revoke = async () => {
    setStatus("working");
    setMessage(null);
    const result = await unlinkStudentAccount(learner.studentId);
    if (result.ok) {
      setStatus("done");
      setMessage(
        `${learner.name} can no longer sign in. Their lessons, homework and progress are untouched.`,
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <div className="access-row">
      <div className="access-head">
        <span className={`avatar avatar-small avatar-${learner.tone}`}>
          {learner.initials}
        </span>
        <span className="access-copy">
          <strong>{learner.name}</strong>
          <small>
            {learner.hasLogin
              ? "Has their own login"
              : "No login — cannot see their own work"}
          </small>
        </span>

        {learner.hasLogin ? (
          <button
            className="secondary-button access-button"
            onClick={() => void revoke()}
            disabled={status === "working"}
          >
            {status === "working" ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <UserRoundX size={14} />
            )}{" "}
            Revoke
          </button>
        ) : (
          <button
            className="secondary-button access-button"
            onClick={() => setOpen((value) => !value)}
          >
            <UserRoundCheck size={14} /> Give access
          </button>
        )}
      </div>

      {open && !learner.hasLogin && (
        <form
          className="workflow-form access-form"
          onSubmit={(event) => {
            event.preventDefault();
            void grant();
          }}
        >
          <label>
            <span>The email address they signed up with</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="them@example.com"
              autoComplete="off"
            />
          </label>
          <p className="access-hint">
            They need to create their own account first, at the sign-up page.
            You are connecting an existing account, not creating one.
          </p>
          <div className="workflow-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={status === "working"}
            >
              {status === "working" ? (
                <>
                  <Loader2 size={14} className="spin" /> Connecting…
                </>
              ) : (
                "Connect"
              )}
            </button>
          </div>
        </form>
      )}

      {status === "failed" && message && (
        <p className="create-modal-error access-message" role="alert">
          <AlertCircle size={15} />
          <span>{message}</span>
        </p>
      )}
      {status === "done" && message && (
        <p className="create-modal-notice access-message" role="status">
          <CheckCircle2 size={15} />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
