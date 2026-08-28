"use client";

/**
 * Homework checking — steps 6 and 7 of the teaching workflow.
 *
 * WHY THIS IS NOT THE FOUR-COLUMN BOARD
 * -------------------------------------
 * The board shows where every piece of work sits. That is a status view, and it
 * is the right shape once assigned and returned work is queried. Right now the
 * only homework the server fetches is what is waiting on the teacher, so a board
 * would show two permanently empty columns and imply nothing was ever assigned.
 *
 * What the teacher needs before a lesson is narrower anyway: the work in front
 * of them, and somewhere to write. So this is a queue and a marking pane. The
 * board returns when `getTriageData` fetches the other two columns — recorded in
 * docs/CURRENT_STATE.md rather than faked here.
 *
 * SAVING AND RELEASING ARE SEPARATE
 * ---------------------------------
 * Deliberately, and enforced in Postgres rather than here: the policy in
 * `0005_homework.sql` only lets a student read feedback once `released_at` is
 * set. A teacher can mark half a script, leave, and come back — the learner sees
 * nothing until the teacher says so.
 */

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  Send,
} from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { recordFeedback } from "@/lib/actions/workflow";
import { dueLabel } from "@/lib/dashboard/time";
import type { PendingHomework } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";
import { FileUpload } from "@/components/files/FileUpload";

export function HomeworkChecking({
  track,
  workspaceId,
  submissions,
  now,
}: {
  track: Track;
  workspaceId: string | null;
  submissions: PendingHomework[];
  now: Date;
}) {
  const queue = submissions.filter((item) => item.track === track);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Falls through to the head of the queue: once a piece is released it leaves
  // the list, and pinning a stale id would leave the pane blank with work left.
  const selected =
    queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;

  if (!selected) {
    return (
      <section className="checking-workspace">
        <article className="panel">
          <PanelHeader
            kicker={`${track} homework`}
            title="Nothing waiting on you"
          />
          <EmptyState
            icon={ClipboardCheck}
            title="No homework to check"
            hint={
              track === "ESL"
                ? "Submitted ESL practice appears here for feedback before the next lesson."
                : "Submitted IELTS tasks appear here for criterion feedback before the next lesson."
            }
          />
        </article>
      </section>
    );
  }

  return (
    <section className="checking-workspace">
      <article className="panel checking-queue">
        <PanelHeader
          kicker={`${track} to check`}
          title={`${queue.length} waiting`}
        />
        <div className="checking-list">
          {queue.map((item) => (
            <button
              key={item.id}
              className={`checking-row ${item.id === selected.id ? "is-selected" : ""}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className={`avatar avatar-small avatar-${item.tone}`}>
                {item.studentInitials}
              </span>
              <span className="checking-row-copy">
                <strong>{item.studentName}</strong>
                <small>{item.task}</small>
              </span>
              <em className={item.blocksLessonId ? "is-blocking" : ""}>
                <Clock3 size={11} /> {dueLabel(item.dueAt, now)}
              </em>
            </button>
          ))}
        </div>
      </article>

      <CheckingPane
        // Remount per submission: feedback in progress must never carry over to
        // another learner's work.
        key={selected.id}
        track={track}
        workspaceId={workspaceId}
        submission={selected}
      />
    </section>
  );
}

function CheckingPane({
  track,
  workspaceId,
  submission,
}: {
  track: Track;
  workspaceId: string | null;
  submission: PendingHomework;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const save = async (release: boolean) => {
    if (!body.trim()) {
      setStatus("failed");
      setMessage("Write the feedback first.");
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("You are not signed in to a workspace.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await recordFeedback({
      workspaceId,
      submissionId: submission.id,
      studentId: submission.studentId,
      body,
      release,
    });

    if (result.ok) {
      setStatus("saved");
      setMessage(
        release
          ? `Feedback released to ${submission.studentName}.`
          : "Saved. The learner cannot see this yet.",
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <article className="panel checking-pane">
      <PanelHeader
        kicker={submission.task}
        title={submission.studentName}
        action={
          <span className="draft-label">
            {track === "ESL" ? "ESL practice" : "IELTS task"}
          </span>
        }
      />

        <div className="checking-body">
        <span className="checking-label">What they submitted</span>
        {submission.body.trim() ? (
          <div className="checking-submission">{submission.body}</div>
        ) : (
          <div className="checking-submission is-empty">
            Nothing written — the learner submitted without text.
          </div>
        )}
        {workspaceId && (
          <div style={{ margin: "12px 0" }}>
            <FileUpload
              workspaceId={workspaceId}
              studentId={submission.studentId}
              submissionId={submission.id}
              bucketId="homework-submissions"
              label="Attach feedback file (optional)"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx"
              maxSizeMB={25}
            />
          </div>
        )}

        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <label>
            <span>
              {track === "ESL"
                ? "Feedback — what they did well, and the next step"
                : "Feedback — against the band criteria"}
            </span>
            <textarea
              className="tall"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                track === "ESL"
                  ? "Strong use of past simple. Next: link two events with “while”."
                  : "Task Response 6.5 — position is clear, but the second body paragraph develops two ideas at once."
              }
            />
          </label>

          {status === "failed" && message && (
            <p className="create-modal-error" role="alert">
              <AlertCircle size={15} />
              <span>{message}</span>
            </p>
          )}

          {status === "saved" && message && (
            <p className="create-modal-notice" role="status">
              <CheckCircle2 size={15} />
              <span>{message}</span>
            </p>
          )}

          <div className="workflow-actions">
            <button
              type="submit"
              className="secondary-button"
              disabled={status === "saving"}
            >
              {status === "saving" ? (
                <>
                  <Loader2 size={14} className="spin" /> Saving…
                </>
              ) : (
                "Save without releasing"
              )}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={status === "saving"}
              onClick={() => void save(true)}
            >
              <Send size={15} /> Release to learner
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}
