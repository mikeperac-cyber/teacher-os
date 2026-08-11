"use client";

/**
 * The learner's own view — step 6 of the teaching workflow, and the last one
 * that had no screen.
 *
 * WHY THIS IS NOT THE TEACHER SHELL WITH THINGS HIDDEN
 * ----------------------------------------------------
 * The teaching workspace is built around triage: what is blocking the next
 * lesson, who is at risk, what to do in the next thirty seconds. None of that
 * is a learner's problem. They have three questions — what do I owe, when is my
 * next class, how am I doing — so the portal answers those three and stops.
 *
 * Hiding navigation would also be the wrong kind of safety. Row Level Security
 * is what stops a learner reading another learner's work; this component simply
 * has nothing else to render, because `StudentSnapshot` has no field for it.
 */

import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Loader2,
  LogOut,
  MessageSquareText,
  TrendingUp,
} from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { submitHomework } from "@/lib/actions/workflow";
import { signOutAction } from "@/lib/auth/actions";
import { clock, dueLabel, timeRange } from "@/lib/dashboard/time";
import { ESL_SKILL_LABELS } from "@/lib/types/domain";
import type {
  StudentHomework,
  StudentHomeworkState,
  StudentSnapshot,
} from "@/lib/types/student";

const STATE_LABEL: Record<StudentHomeworkState, string> = {
  todo: "To do",
  draft: "Draft saved",
  submitted: "With your teacher",
  returned: "Feedback ready",
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function StudentPortal({
  snapshot,
  displayName,
  nowIso,
}: {
  snapshot: StudentSnapshot;
  displayName: string;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const { learner, lessons, homework, progress } = snapshot;

  // A signed-in user with no learner record. Not an error and not a bug — an
  // owner has not linked them yet. Saying so beats an empty screen.
  if (!learner) {
    return (
      <div className="student-shell">
        <StudentHeader displayName={displayName} track={null} />
        <main className="student-main">
          <article className="panel">
            <PanelHeader kicker="Your account" title="Not linked yet" />
            <EmptyState
              icon={GraduationCap}
              title="Your teacher has not connected your account"
              hint="Once they link this email address to your learner record, your lessons, homework and progress appear here."
            />
          </article>
        </main>
      </div>
    );
  }

  const nextLesson =
    lessons.find((lesson) => new Date(lesson.startsAt) >= now) ?? null;
  const outstanding = homework.filter(
    (item) => item.state === "todo" || item.state === "draft",
  );

  return (
    <div className="student-shell">
      <StudentHeader displayName={learner.fullName} track={learner.track} />

      <main className="student-main">
        <section className="student-summary">
          <article className="panel student-next">
            <PanelHeader kicker="Next class" title={nextLesson ? dayLabel(nextLesson.startsAt) : "Nothing scheduled"} />
            {nextLesson ? (
              <div className="student-next-body">
                <strong>
                  {timeRange(
                    new Date(nextLesson.startsAt),
                    new Date(nextLesson.endsAt),
                  )}
                </strong>
                <span>
                  <CalendarDays size={13} /> {learner.track === "ESL" ? "English lesson" : "IELTS Academic lesson"}
                </span>
              </div>
            ) : (
              <div className="student-next-body is-empty">
                <span>Your teacher has not booked your next class yet.</span>
              </div>
            )}
          </article>

          <article className="panel student-owed">
            <PanelHeader kicker="Homework" title={outstanding.length === 0 ? "All caught up" : `${outstanding.length} to do`} />
            <div className="student-next-body">
              {outstanding.length === 0 ? (
                <span>
                  <Check size={13} /> Nothing is waiting on you.
                </span>
              ) : (
                <span>
                  <Clock3 size={13} /> {dueLabel(outstanding[0].dueAt, now)} —{" "}
                  {outstanding[0].title}
                </span>
              )}
            </div>
          </article>
        </section>

        <article className="panel">
          <PanelHeader kicker="Your work" title="Homework" />
          {homework.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No homework yet"
              hint="Work your teacher sets appears here, with somewhere to write your answer."
            />
          ) : (
            <div className="student-homework-list">
              {homework.map((item) => (
                <HomeworkItem
                  key={item.assignmentId}
                  item={item}
                  workspaceId={learner.workspaceId}
                  studentId={learner.studentId}
                  now={now}
                />
              ))}
            </div>
          )}
        </article>

        <div className="student-lower">
          <article className="panel">
            <PanelHeader
              kicker={learner.track === "ESL" ? "Your English" : "Your bands"}
              title="Progress"
            />
            <ProgressPanel progress={progress} />
          </article>

          <article className="panel">
            <PanelHeader kicker="Your classes" title="Lessons" />
            {lessons.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No lessons yet"
                hint="Your booked classes appear here."
              />
            ) : (
              <div className="student-lesson-list">
                {lessons.map((lesson) => (
                  <div className="student-lesson" key={lesson.id}>
                    <span className="student-lesson-when">
                      <strong>{dayLabel(lesson.startsAt)}</strong>
                      <small>{clock(new Date(lesson.startsAt))}</small>
                    </span>
                    {lesson.sharedNote && (
                      <p className="student-lesson-note">
                        <MessageSquareText size={12} /> {lesson.sharedNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </main>
    </div>
  );
}

function StudentHeader({
  displayName,
  track,
}: {
  displayName: string;
  track: "ESL" | "IELTS" | null;
}) {
  return (
    <header className="student-header">
      <div className="student-brand">
        <span className="brand-mark">
          <GraduationCap size={18} strokeWidth={2.2} />
        </span>
        <span className="brand-copy">
          <strong>Teacher</strong>
          <em>OS</em>
        </span>
      </div>
      <div className="student-identity">
        <span>
          <strong>{displayName}</strong>
          {track && <small>{track === "ESL" ? "English" : "IELTS Academic"}</small>}
        </span>
        <form action={signOutAction}>
          <button className="student-signout" type="submit">
            <LogOut size={14} /> Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

function HomeworkItem({
  item,
  workspaceId,
  studentId,
  now,
}: {
  item: StudentHomework;
  workspaceId: string;
  studentId: string;
  now: Date;
}) {
  const [body, setBody] = useState(item.body);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  // Once it is with the teacher it is out of the learner's hands. The policy
  // says the same thing — a submission may only be edited while it is a draft —
  // so a writable box here would be a promise the database refuses to keep.
  const editable = item.state === "todo" || item.state === "draft";

  const save = async (submit: boolean) => {
    if (submit && !body.trim()) {
      setStatus("failed");
      setMessage("Write your answer before sending it.");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await submitHomework({
      workspaceId,
      assignmentId: item.assignmentId,
      studentId,
      body,
      submit,
    });

    if (result.ok) {
      setStatus("saved");
      setMessage(
        submit
          ? "Sent to your teacher."
          : "Draft saved. Your teacher cannot see it yet.",
      );
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  return (
    <section className={`student-homework is-${item.state}`}>
      <header>
        <span className="student-homework-copy">
          <strong>{item.title}</strong>
          <small>
            <Clock3 size={11} /> {dueLabel(item.dueAt, now)}
            {item.estimatedMinutes ? ` · about ${item.estimatedMinutes} min` : ""}
          </small>
        </span>
        <em className="student-homework-state">{STATE_LABEL[item.state]}</em>
      </header>

      {item.instructions && (
        <p className="student-homework-instructions">{item.instructions}</p>
      )}

      {editable ? (
        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <label>
            <span>Your answer</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your answer here"
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
                "Save draft"
              )}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={status === "saving"}
              onClick={() => void save(true)}
            >
              <CheckCircle2 size={15} /> Send to teacher
            </button>
          </div>
        </form>
      ) : (
        <div className="student-homework-done">
          <span className="student-answer-label">What you sent</span>
          <div className="student-answer">{item.body || "(no text)"}</div>

          {item.feedback ? (
            <>
              <span className="student-answer-label">
                Feedback from your teacher
              </span>
              <div className="student-feedback">{item.feedback}</div>
            </>
          ) : (
            <p className="student-awaiting">
              <Clock3 size={13} /> Your teacher has not sent feedback yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Two renderings, chosen by the discriminant — never one shared "score" view.
 * The union in `lib/types/student.ts` makes the alternative unrepresentable.
 */
function ProgressPanel({
  progress,
}: {
  progress: StudentSnapshot["progress"];
}) {
  if (progress.track === "ESL") {
    const latest = progress.entries[0];
    if (!latest) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No progress shared yet"
          hint="When your teacher shares a progress check, it appears here."
        />
      );
    }
    const columns = [
      "grammar",
      "vocabulary",
      "speaking",
      "listening",
      "reading",
      "confidence",
    ] as const;

    return (
      <div className="student-progress">
        <div className="student-skill-grid">
          {columns.map((column, index) => {
            const value = latest.scores[column];
            return (
              <span className="student-skill" key={column}>
                <b>{ESL_SKILL_LABELS[index]}</b>
                <i>
                  <em style={{ width: `${value ?? 0}%` }} />
                </i>
                {/* An unobserved skill shows a dash, not a zero. */}
                <strong>{value === undefined ? "—" : `${value}%`}</strong>
              </span>
            );
          })}
        </div>
        {latest.note && <p className="student-progress-note">{latest.note}</p>}
      </div>
    );
  }

  if (progress.bands.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No bands shared yet"
        hint="When your teacher shares a band score, it appears here."
      />
    );
  }

  // Most recent band per skill; the query already returns newest first.
  const latest = new Map<string, number>();
  for (const entry of progress.bands) {
    if (!latest.has(entry.skill)) latest.set(entry.skill, entry.band);
  }

  return (
    <div className="student-progress">
      <div className="student-band-grid">
        {(["Listening", "Reading", "Writing", "Speaking"] as const).map(
          (skill) => (
            <span className="student-band" key={skill}>
              <b>{skill}</b>
              <strong>{latest.has(skill) ? latest.get(skill)!.toFixed(1) : "—"}</strong>
            </span>
          ),
        )}
      </div>
    </div>
  );
}
