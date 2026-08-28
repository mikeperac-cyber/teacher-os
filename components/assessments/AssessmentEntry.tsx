"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, FileCheck2 } from "lucide-react";
import { EmptyState, PanelHeader } from "@/components/primitives";
import { ensureDefaultTemplates, recordAssessment } from "@/lib/actions/assessments";
import type { StudentSignal } from "@/lib/types/domain";

type Criterion = { id: string; label: string; max_score: number | null };

export function AssessmentEntry({
  workspaceId,
  students,
  track,
}: {
  workspaceId: string | null;
  students: StudentSignal[];
  track: "ESL" | "IELTS";
}) {
  const learners = students.filter((s) => s.track === track);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<{ id: string; title: string; criteria: Criterion[] }[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    // Ensure defaults then fetch
    void ensureDefaultTemplates(workspaceId).then(async () => {
      try {
        const res = await fetch(`/api/rubrics?workspaceId=${workspaceId}&track=${track.toLowerCase()}`);
        if (res.ok) {
          const data = (await res.json()) as { templates: { id: string; title: string; criteria: Criterion[] }[] };
          setTemplates(data.templates);
          if (data.templates[0]) setTemplateId(data.templates[0].id);
        }
      } catch {
        // leave empty; user can still create custom
      }
    });
  }, [workspaceId, track]);

  if (learners.length === 0) {
    return (
      <article className="panel">
        <PanelHeader kicker={`${track} assessment`} title="Record assessment" />
        <EmptyState icon={FileCheck2} title={`No ${track} learners yet`} hint="Create a learner before recording an assessment." />
      </article>
    );
  }

  const activeTemplate = templates.find((t) => t.id === templateId) ?? templates[0];
  const criteria: Criterion[] = activeTemplate?.criteria ?? [];

  const save = async (release: boolean) => {
    if (!title.trim()) {
      setStatus("failed");
      setMessage("Give the assessment a title.");
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("Not signed in to a workspace.");
      return;
    }
    const chosen = studentId || learners[0].studentId;
    const payload = Object.entries(scores)
      .filter(([, v]) => v.trim() !== "")
      .map(([cid, v]) => {
        const num = Number(v);
        if (track === "IELTS") return { criterionId: cid, band: num };
        return { criterionId: cid, score: num };
      });

    if (payload.length === 0) {
      setStatus("failed");
      setMessage("Score at least one criterion.");
      return;
    }

    // Validate bands/marks
    for (const p of payload) {
      const val = p.band ?? p.score;
      if (val === undefined || Number.isNaN(val)) {
        setStatus("failed");
        setMessage("Scores must be numbers.");
        return;
      }
      if (track === "IELTS" && (val < 0 || val > 9 || (val * 2) % 1 !== 0)) {
        setStatus("failed");
        setMessage("IELTS bands must be 0-9 in half steps.");
        return;
      }
      if (track === "ESL" && (val < 0 || val > 100)) {
        setStatus("failed");
        setMessage("ESL mastery must be 0-100.");
        return;
      }
    }

    setStatus("saving");
    setMessage(null);
    const result = await recordAssessment({
      workspaceId,
      studentId: chosen,
      track,
      title: title.trim(),
      templateId: activeTemplate?.id,
      scores: payload,
      release,
    });
    if (result.ok) {
      setStatus("saved");
      setMessage(release ? "Assessment scored and released." : "Assessment saved. Learner cannot see it yet.");
      setTitle("");
      setScores({});
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <article className="panel">
      <PanelHeader kicker={`${track} assessment`} title={track === "ESL" ? "Record progress check" : "Record mock / criterion scores"} />
      <form
        className="workflow-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <label>
          <span>Learner</span>
          <select value={studentId || learners[0].studentId} onChange={(e) => setStudentId(e.target.value)}>
            {learners.map((l) => (
              <option key={l.studentId} value={l.studentId}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={track === "ESL" ? "Progress check — Unit 4" : "Mock — Full test 12 Oct"} />
        </label>

        {templates.length > 0 && (
          <label>
            <span>Rubric</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {criteria.length > 0 ? (
          <div className="score-grid">
            {criteria.map((c) => (
              <label key={c.id}>
                <span>{c.label}</span>
                <input
                  type="number"
                  step={track === "IELTS" ? 0.5 : 1}
                  min={0}
                  max={track === "IELTS" ? 9 : 100}
                  value={scores[c.id] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="workflow-hint">No criteria yet — create a rubric template first, or use the default IELTS/ESL ones which will appear after the first save.</p>
        )}

        {status === "failed" && message && (
          <p className="create-modal-error" role="alert">
            <AlertCircle size={15} /> <span>{message}</span>
          </p>
        )}
        {status === "saved" && message && (
          <p className="create-modal-notice" role="status">
            <CheckCircle2 size={15} /> <span>{message}</span>
          </p>
        )}

        <div className="workflow-actions">
          <button type="submit" className="secondary-button" disabled={status === "saving"}>
            {status === "saving" ? <><Loader2 size={14} className="spin" /> Saving…</> : "Save privately"}
          </button>
          <button type="button" className="primary-button" disabled={status === "saving"} onClick={() => void save(true)}>
            <CheckCircle2 size={15} /> Save & release
          </button>
        </div>
      </form>
    </article>
  );
}
