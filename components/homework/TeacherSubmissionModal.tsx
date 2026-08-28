"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { recordSubmissionOnBehalf } from "@/lib/actions/workflow";
import type { StudentSignal } from "@/lib/types/domain";

export function TeacherSubmissionModal({
  workspaceId,
  students,
  assignments,
  close,
}: {
  workspaceId: string | null;
  students: StudentSignal[];
  assignments: { id: string; title: string; student_id: string; track: string }[];
  close: () => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.studentId ?? "");
  const filteredAssignments = assignments.filter((a) => !studentId || a.student_id === studentId);
  const [assignmentId, setAssignmentId] = useState(filteredAssignments[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    if (!body.trim()) {
      setStatus("failed");
      setMessage("Write what the learner submitted.");
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("Not signed in to a workspace.");
      return;
    }
    if (!assignmentId || !studentId) {
      setStatus("failed");
      setMessage("Choose a learner and assignment.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const res = await recordSubmissionOnBehalf({
      workspaceId,
      assignmentId,
      studentId,
      body: body.trim(),
      status: "submitted",
    });
    if (res.ok) {
      setStatus("saved");
      setMessage("Submission recorded. It now appears in the checking queue.");
      setBody("");
      return;
    }
    setStatus("failed");
    setMessage(res.error);
  };

  return (
    <div className="destination-backdrop" onMouseDown={close}>
      <aside className="destination-drawer" onMouseDown={(e) => e.stopPropagation()} aria-label="Record paper submission">
        <header className="destination-head">
          <div>
            <span className="eyebrow">Homework</span>
            <h2>Record paper submission</h2>
            <p>For work handed in on paper, by email, or completed in class. This creates the submission so you can give feedback before the next lesson.</p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">×</button>
        </header>
        <div className="destination-body">
          <form
            className="workflow-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              <span>Learner</span>
              <select value={studentId} onChange={(e) => {
                setStudentId(e.target.value);
                const next = assignments.filter((a) => a.student_id === e.target.value)[0];
                if (next) setAssignmentId(next.id);
              }}>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} · {s.track}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Assignment</span>
              <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
                {filteredAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
                {filteredAssignments.length === 0 && <option value="">No assignments for this learner</option>}
              </select>
            </label>

            <label>
              <span>What they submitted (transcribed)</span>
              <textarea className="tall" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Transcribe or summarize the paper submission…" />
            </label>

            {status === "failed" && message && (
              <p className="create-modal-error" role="alert"><AlertCircle size={15} /> <span>{message}</span></p>
            )}
            {status === "saved" && message && (
              <p className="create-modal-notice" role="status"><CheckCircle2 size={15} /> <span>{message}</span></p>
            )}

            <div className="workflow-actions">
              <button type="button" className="secondary-button" onClick={close}>Close</button>
              <button type="submit" className="primary-button" disabled={status === "saving"}>
                {status === "saving" ? <><Loader2 size={14} className="spin" /> Saving…</> : "Record submission"}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
