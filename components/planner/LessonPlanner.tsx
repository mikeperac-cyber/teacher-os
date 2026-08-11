"use client";

/**
 * Lesson preparation — step 3 of the teaching workflow.
 *
 * This screen unblocks the dashboard's headline panel. Until it existed a
 * lesson could be scheduled but never prepared, so the prep checklist could
 * never reach ready and the readiness figure was permanently stuck below 100%.
 *
 * The layout is the one the planner already had — brief, rundown, readiness —
 * because the design was not the problem; the missing writes were. What changed
 * is that all three now read and write real records:
 *
 *   brief     → lesson_plans.objective / focus / teacher_note
 *   rundown   → lesson_plans.blocks
 *   readiness → buildPrepChecklist, the same derivation the dashboard uses
 *
 * The readiness panel is deliberately NOT a set of tick boxes any more. Ticking
 * "homework returned" by hand states a fact the database already knows and can
 * contradict; a checklist a teacher can lie to is worse than none.
 *
 * The objective label differs per track and that is not cosmetic: an ESL lesson
 * aims at something the learner can do afterwards, an IELTS lesson at something
 * an examiner would award. Merging them would be the CLAUDE.md rule 5 regression
 * wearing a different hat.
 */

import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { saveLessonPlan } from "@/lib/actions/workflow";
import { buildPrepChecklist } from "@/lib/dashboard/prep-checklist";
import { clock, timeRange } from "@/lib/dashboard/time";
import type { UpcomingLesson } from "@/lib/types/domain";
import type { Tone, Track } from "@/lib/types/ui";

type Block = { time: string; title: string; detail: string; tone: Tone };

/** Cycled so consecutive activities are visually distinct in the rundown. */
const BLOCK_TONES: Tone[] = ["violet", "blue", "mint", "amber"];

/**
 * A starting shape rather than a blank list.
 *
 * Both tracks get a warm-up, a main phase and a close, because a 60-minute
 * lesson has that shape regardless of track — but the middle differs, and the
 * teacher edits every row anyway.
 */
function startingBlocks(track: Track): Block[] {
  return track === "ESL"
    ? [
        { time: "0–10", title: "Warm-up", detail: "", tone: "violet" },
        { time: "10–25", title: "Presentation", detail: "", tone: "blue" },
        { time: "25–45", title: "Controlled practice", detail: "", tone: "mint" },
        { time: "45–60", title: "Free production", detail: "", tone: "amber" },
      ]
    : [
        { time: "0–10", title: "Review of last task", detail: "", tone: "violet" },
        { time: "10–25", title: "Criterion focus", detail: "", tone: "blue" },
        { time: "25–50", title: "Timed practice", detail: "", tone: "mint" },
        { time: "50–60", title: "Band feedback", detail: "", tone: "amber" },
      ];
}

function whenLabel(lesson: UpcomingLesson): string {
  const start = new Date(lesson.startsAt);
  const end = new Date(lesson.endsAt);
  if (Number.isNaN(start.getTime())) return "Unscheduled";
  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day} · ${Number.isNaN(end.getTime()) ? clock(start) : timeRange(start, end)}`;
}

export function LessonPlanner({
  track,
  workspaceId,
  lessons,
  now,
}: {
  track: Track;
  workspaceId: string | null;
  lessons: UpcomingLesson[];
  now: Date;
}) {
  const trackLessons = lessons.filter((lesson) => lesson.track === track);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Falls back to the soonest lesson rather than pinning the selection at mount:
  // once a save revalidates and the list re-sorts, a stale id would silently
  // select nothing.
  const selected =
    trackLessons.find((lesson) => lesson.id === selectedId) ??
    trackLessons[0] ??
    null;

  if (!selected) {
    return (
      <section className="planner-workspace">
        <article className="panel planner-brief">
          <PanelHeader kicker={`${track} lesson brief`} title="No lesson to prepare" />
          <EmptyState
            icon={NotebookPen}
            title="Nothing scheduled"
            hint={
              track === "ESL"
                ? "Schedule an ESL lesson to plan from a CEFR outcome."
                : "Schedule an IELTS lesson to plan from a target band and rubric gap."
            }
          />
        </article>
      </section>
    );
  }

  return (
    <PlannerForm
      // Remounting on lesson change is the point: the form holds a draft, and
      // carrying one lesson's draft into another would be a data-entry hazard.
      key={selected.id}
      track={track}
      workspaceId={workspaceId}
      lesson={selected}
      lessons={trackLessons}
      onSelect={setSelectedId}
      now={now}
    />
  );
}

function PlannerForm({
  track,
  workspaceId,
  lesson,
  lessons,
  onSelect,
  now,
}: {
  track: Track;
  workspaceId: string | null;
  lesson: UpcomingLesson;
  lessons: UpcomingLesson[];
  onSelect: (id: string) => void;
  now: Date;
}) {
  const [objective, setObjective] = useState(lesson.objective ?? "");
  const [focus, setFocus] = useState("");
  const [note, setNote] = useState("");
  const [blocks, setBlocks] = useState<Block[]>(() => startingBlocks(track));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const prep = buildPrepChecklist(lesson, now);
  const isEsl = track === "ESL";

  const updateBlock = (index: number, patch: Partial<Block>) =>
    setBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      ),
    );

  const save = async (markReady: boolean) => {
    if (!objective.trim()) {
      setStatus("failed");
      setMessage(
        isEsl
          ? "Set a communicative outcome — what should the learner be able to do afterwards?"
          : "Set a band objective — which criterion is this lesson moving?",
      );
      return;
    }
    if (!workspaceId) {
      setStatus("failed");
      setMessage("You are not signed in to a workspace.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    // An activity with no title is a row the teacher started and abandoned.
    // Saving it would inflate the readiness count with nothing to teach from.
    const named = blocks.filter((block) => block.title.trim());

    const result = await saveLessonPlan({
      workspaceId,
      lessonId: lesson.id,
      studentId: lesson.studentId,
      track,
      objective,
      focus: focus.trim() || undefined,
      teacherNote: note.trim() || undefined,
      blocks: named,
      markReady,
    });

    if (result.ok) {
      setStatus("saved");
      setMessage(
        markReady
          ? "Plan saved and marked ready."
          : `Plan saved${named.length ? ` with ${named.length} activities.` : "."}`,
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <section className="planner-workspace">
      <article className="panel planner-brief">
        <PanelHeader
          kicker={`${track} lesson brief`}
          title={lesson.studentName}
          action={
            lessons.length > 1 ? (
              <select
                className="planner-lesson-select"
                value={lesson.id}
                onChange={(event) => onSelect(event.target.value)}
                aria-label={`Choose which ${track} lesson to prepare`}
              >
                {lessons.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.studentName} · {whenLabel(option)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="draft-label">
                <CalendarDays size={12} /> {whenLabel(lesson)}
              </span>
            )
          }
        />

        <form
          className="planner-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <label>
            <span>{isEsl ? "CEFR learning outcome" : "Band-score objective"}</span>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder={
                isEsl
                  ? "Narrate a past event using past simple and past continuous"
                  : "Move Task Response from Band 6 to 7 by developing one idea per paragraph"
              }
            />
          </label>

          <div className="form-row">
            <label>
              <span>Course</span>
              <input value={lesson.courseLabel} readOnly />
            </label>
            <label>
              <span>{isEsl ? "Language focus" : "Skill / task"}</span>
              <input
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder={isEsl ? "Past tenses" : "Writing Task 2"}
              />
            </label>
          </div>

          <label>
            <span>Teacher note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything to remember before the class starts"
            />
          </label>

          {status === "failed" && message && (
            <p className="planner-message is-error" role="alert">
              <AlertCircle size={15} />
              <span>{message}</span>
            </p>
          )}

          {status === "saved" && message && (
            <p className="planner-message is-notice" role="status">
              <CheckCircle2 size={15} />
              <span>{message}</span>
            </p>
          )}

          <div className="planner-actions">
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
                "Save plan"
              )}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={status === "saving"}
              onClick={() => void save(true)}
            >
              <CheckCircle2 size={15} /> Save &amp; mark ready
            </button>
          </div>
        </form>
      </article>

      <article className="panel lesson-rundown">
        <PanelHeader
          kicker={isEsl ? "ESA-aligned rundown" : "Score-focused rundown"}
          title="60-minute lesson flow"
          action={
            <button
              className="ghost-button"
              onClick={() =>
                setBlocks((current) => [
                  ...current,
                  {
                    time: "",
                    title: "",
                    detail: "",
                    tone: BLOCK_TONES[current.length % BLOCK_TONES.length],
                  },
                ])
              }
            >
              <Plus size={14} /> Activity
            </button>
          }
        />
        <div className="rundown-list">
          {blocks.map((block, index) => (
            <div className="rundown-row is-editable" key={index}>
              <span className={`rundown-index ${block.tone}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="rundown-fields">
                <input
                  value={block.title}
                  onChange={(event) =>
                    updateBlock(index, { title: event.target.value })
                  }
                  placeholder="Activity"
                  aria-label={`Activity ${index + 1} title`}
                />
                <input
                  value={block.detail}
                  onChange={(event) =>
                    updateBlock(index, { detail: event.target.value })
                  }
                  placeholder="What happens, and what you are looking for"
                  aria-label={`Activity ${index + 1} detail`}
                />
              </div>
              <input
                className="rundown-time-input"
                value={block.time}
                onChange={(event) =>
                  updateBlock(index, { time: event.target.value })
                }
                placeholder="0–10"
                aria-label={`Activity ${index + 1} minutes`}
              />
              <button
                className="rundown-remove"
                onClick={() =>
                  setBlocks((current) =>
                    current.filter((_, blockIndex) => blockIndex !== index),
                  )
                }
                aria-label={`Remove activity ${index + 1}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {blocks.length === 0 && (
            <EmptyState
              icon={NotebookPen}
              title="No activities yet"
              hint="Add the first activity to give the lesson a shape."
            />
          )}
        </div>
      </article>

      <aside className="planner-resources">
        <article className="panel prep-check">
          <PanelHeader kicker="Pre-class" title="Readiness check" />
          {/* Read-only on purpose: every item is a fact the database holds. */}
          {prep.items.map((item) => (
            <div
              key={item.id}
              className={`prep-fact ${item.ready ? "done" : ""}`}
              title={item.detail}
            >
              {item.ready ? <Check size={13} /> : <Circle size={13} />}
              <span>{item.label}</span>
            </div>
          ))}
          <div className="prep-score">
            <span>{track} lesson readiness</span>
            <strong>{prep.readiness}%</strong>
          </div>
        </article>
      </aside>
    </section>
  );
}
