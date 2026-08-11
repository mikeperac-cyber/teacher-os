"use client";

/**
 * IELTS Academic band entry.
 *
 * The counterpart to the ESL mastery form, and deliberately not the same
 * component — see the note in `EslProgressEntry.tsx`.
 *
 * Bands are a `<select>` rather than a number field. The scale is not continuous
 * (0–9 in half-band steps), and there is no such thing as 6.3. A free-text
 * number invites one, and the `band_score` domain in Postgres would reject it
 * after the teacher had already typed it — a rejection is worse than an
 * impossibility.
 */

import { useState } from "react";
import { AlertCircle, CheckCircle2, Gauge, Loader2 } from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { recordIeltsBands } from "@/lib/actions/workflow";
import { IELTS_SKILLS } from "@/lib/types/domain";
import type { StudentSignal } from "@/lib/types/domain";

type BandField = "listening" | "reading" | "writing" | "speaking";

const BAND_FIELDS: BandField[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];

/** The official scale: 0–9, half bands only. */
const BANDS = Array.from({ length: 19 }, (_, index) => index / 2);

export function IeltsBandEntry({
  workspaceId,
  students,
}: {
  workspaceId: string | null;
  students: StudentSignal[];
}) {
  const candidates = students.filter((student) => student.track === "IELTS");
  const [studentId, setStudentId] = useState("");
  const [bands, setBands] = useState<Partial<Record<BandField, string>>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <article className="panel">
        <PanelHeader kicker="Band scores" title="Record bands" />
        <EmptyState
          icon={Gauge}
          title="No IELTS candidates yet"
          hint="Add a candidate before recording bands against their target."
        />
      </article>
    );
  }

  const save = async (release: boolean) => {
    const chosen = studentId || candidates[0].studentId;

    const numeric: Partial<Record<BandField, number>> = {};
    for (const field of BAND_FIELDS) {
      const raw = bands[field];
      if (raw === undefined || raw === "") continue;
      numeric[field] = Number(raw);
    }

    if (Object.keys(numeric).length === 0) {
      setStatus("failed");
      setMessage("Record at least one band.");
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("You are not signed in to a workspace.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await recordIeltsBands({
      workspaceId,
      studentId: chosen,
      bands: numeric,
      release,
    });

    if (result.ok) {
      setStatus("saved");
      setBands({});
      setMessage(
        release
          ? `${result.data.recorded} band${result.data.recorded === 1 ? "" : "s"} recorded and visible to the candidate.`
          : `${result.data.recorded} band${result.data.recorded === 1 ? "" : "s"} recorded. The candidate cannot see them yet.`,
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <article className="panel">
      <PanelHeader kicker="Band scores" title="Record bands" />
      <form
        className="workflow-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <label>
          <span>Candidate</span>
          <select
            value={studentId || candidates[0].studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            {candidates.map((candidate) => (
              <option key={candidate.studentId} value={candidate.studentId}>
                {candidate.name}
                {candidate.targetBand !== undefined
                  ? ` · target ${candidate.targetBand.toFixed(1)}`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="score-grid">
          {BAND_FIELDS.map((field, index) => (
            <label key={field}>
              <span>{IELTS_SKILLS[index]}</span>
              <select
                value={bands[field] ?? ""}
                onChange={(event) =>
                  setBands((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
              >
                <option value="">Not scored</option>
                {BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band.toFixed(1)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

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
