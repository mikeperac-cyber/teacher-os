"use client";

/**
 * ESL progress entry — CEFR mastery.
 *
 * Separate file, separate component, separate action from the IELTS band entry
 * beside it, and that separation is the product rule (CLAUDE.md 1, 2 and 5), not
 * an accident of file layout. The two forms look superficially similar — a
 * learner, some numbers, a note — which is exactly why the temptation to merge
 * them exists and exactly why it must be resisted: a CEFR mastery percentage and
 * an IELTS band are different claims about different things, and a shared
 * "score" field would quietly make them interchangeable.
 *
 * Every skill is optional. A teacher who observed speaking and nothing else
 * should record speaking and nothing else, rather than inventing five numbers to
 * satisfy a form.
 */

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { recordEslProgress } from "@/lib/actions/workflow";
import { ESL_SKILL_LABELS } from "@/lib/types/domain";
import type { StudentSignal } from "@/lib/types/domain";

/** Maps a display label to its column. Positional, matching ESL_SKILL_LABELS. */
const SKILL_FIELDS = [
  "grammar",
  "vocabulary",
  "speaking",
  "listening",
  "reading",
  "confidence",
] as const;

type SkillField = (typeof SKILL_FIELDS)[number];

export function EslProgressEntry({
  workspaceId,
  students,
}: {
  workspaceId: string | null;
  students: StudentSignal[];
}) {
  const learners = students.filter((student) => student.track === "ESL");
  const [studentId, setStudentId] = useState("");
  const [scores, setScores] = useState<Partial<Record<SkillField, string>>>({});
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  if (learners.length === 0) {
    return (
      <article className="panel">
        <PanelHeader kicker="CEFR mastery" title="Record progress" />
        <EmptyState
          icon={TrendingUp}
          title="No ESL learners yet"
          hint="Add a learner before recording mastery against their CEFR level."
        />
      </article>
    );
  }

  const save = async (release: boolean) => {
    const chosen = studentId || learners[0].studentId;

    // Only fields the teacher actually filled in are sent. An empty input means
    // "not observed", which is different from zero.
    const numeric: Partial<Record<SkillField, number>> = {};
    for (const field of SKILL_FIELDS) {
      const raw = scores[field];
      if (raw === undefined || raw.trim() === "") continue;
      const value = Number(raw);
      if (Number.isNaN(value)) {
        setStatus("failed");
        setMessage(`${field} must be a number between 0 and 100.`);
        return;
      }
      numeric[field] = value;
    }

    if (Object.keys(numeric).length === 0) {
      setStatus("failed");
      setMessage("Record at least one skill.");
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("You are not signed in to a workspace.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await recordEslProgress({
      workspaceId,
      studentId: chosen,
      scores: numeric,
      note: note.trim() || undefined,
      release,
    });

    if (result.ok) {
      setStatus("saved");
      setScores({});
      setNote("");
      setMessage(
        release
          ? "Progress recorded and visible to the learner."
          : "Progress recorded. The learner cannot see it yet.",
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <article className="panel">
      <PanelHeader kicker="CEFR mastery" title="Record progress" />
      <form
        className="workflow-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <label>
          <span>Learner</span>
          <select
            value={studentId || learners[0].studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            {learners.map((learner) => (
              <option key={learner.studentId} value={learner.studentId}>
                {learner.name}
              </option>
            ))}
          </select>
        </label>

        <div className="score-grid">
          {SKILL_FIELDS.map((field, index) => (
            <label key={field}>
              <span>{ESL_SKILL_LABELS[index]}</span>
              <input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={scores[field] ?? ""}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                placeholder="—"
              />
            </label>
          ))}
        </div>

        <label>
          <span>Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What the evidence was, and what changed"
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
              "Record privately"
            )}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={status === "saving"}
            onClick={() => void save(true)}
          >
            <CheckCircle2 size={15} /> Record &amp; share
          </button>
        </div>
      </form>
    </article>
  );
}
