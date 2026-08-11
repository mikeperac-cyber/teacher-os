"use client";

/**
 * The quick-action row and its modal.
 *
 * Three of the four actions now perform real writes through server actions,
 * which go through Row Level Security like every other write:
 *
 *   Add learner      → createStudent
 *   Plan lesson      → scheduleLesson   (the plan itself lives in the planner)
 *   Assign homework  → assignHomework
 *
 * Recording an assessment still has no form: it needs a set of criteria to
 * score against, and those differ per track — four IELTS band criteria against
 * CEFR mastery percentages. A two-field modal cannot ask for either honestly,
 * so it says what is missing instead. A form that cannot succeed is worse than
 * an admission that it does not exist.
 *
 * The learner list comes from data the dashboard already fetched, so opening
 * this costs no extra query.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import type { ElementType } from "react";

import {
  assignHomework,
  createStudent,
  scheduleLesson,
} from "@/lib/actions/workflow";
import { SUBJECT_LABELS, validateDraft } from "@/lib/actions/create-record";
import type { FieldErrors, RecordKind } from "@/lib/actions/create-record";
import type { StudentSignal } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

type QuickAction = {
  kind: RecordKind;
  icon: ElementType;
  label: Record<Track, string>;
  hint: Record<Track, string>;
};

const ACTIONS: QuickAction[] = [
  {
    kind: "student",
    icon: UserRound,
    label: { ESL: "Add learner", IELTS: "Add candidate" },
    hint: {
      ESL: "Create a CEFR learner profile",
      IELTS: "Create a band-score profile",
    },
  },
  {
    kind: "lesson",
    icon: BookOpen,
    label: { ESL: "Schedule lesson", IELTS: "Schedule lesson" },
    hint: { ESL: "Book an ESL lesson", IELTS: "Book an IELTS lesson" },
  },
  {
    kind: "homework",
    icon: ClipboardCheck,
    label: { ESL: "Assign homework", IELTS: "Assign task" },
    hint: {
      ESL: "Practice that builds usable English",
      IELTS: "Timed practice against a criterion",
    },
  },
  {
    kind: "assessment",
    icon: FileCheck2,
    label: { ESL: "Record check", IELTS: "Record mock" },
    hint: {
      ESL: "Log a CEFR progress check",
      IELTS: "Log mock or section band scores",
    },
  },
];

export function QuickActions({
  track,
  workspaceId,
  students,
}: {
  track: Track;
  workspaceId: string | null;
  students: StudentSignal[];
}) {
  const [openKind, setOpenKind] = useState<RecordKind | null>(null);

  return (
    <>
      <div className="quick-actions">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.kind}
              className="quick-action"
              onClick={() => setOpenKind(action.kind)}
              title={action.hint[track]}
            >
              <Icon size={15} />
              {action.label[track]}
            </button>
          );
        })}
      </div>

      {openKind && (
        <CreateRecordModal
          kind={openKind}
          track={track}
          workspaceId={workspaceId}
          students={students}
          close={() => setOpenKind(null)}
        />
      )}
    </>
  );
}

const HEADINGS: Record<RecordKind, Record<Track, string>> = {
  student: { ESL: "New ESL learner", IELTS: "New IELTS candidate" },
  lesson: { ESL: "Schedule an ESL lesson", IELTS: "Schedule an IELTS lesson" },
  homework: { ESL: "Assign ESL homework", IELTS: "Assign IELTS practice" },
  assessment: { ESL: "Record a progress check", IELTS: "Record a mock result" },
};

const DURATIONS = [30, 45, 60, 90];

/** Local datetime string for an `<input type="datetime-local">`. */
function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Tomorrow at 10:00, as a sensible default rather than an empty field. */
function defaultLessonStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toLocalInputValue(date);
}

export function CreateRecordModal({
  kind,
  track,
  workspaceId,
  students,
  close,
}: {
  kind: RecordKind;
  track: Track;
  workspaceId: string | null;
  students: StudentSignal[];
  close: () => void;
}) {
  // Shared form state. Which fields are used depends on `kind`.
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [studentId, setStudentId] = useState("");
  const [startsAt, setStartsAt] = useState(defaultLessonStart);
  const [duration, setDuration] = useState(60);
  const [dueAt, setDueAt] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLElement>(null);

  const trackStudents = useMemo(
    () => students.filter((student) => student.track === track),
    [students, track],
  );

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const fail = (text: string) => {
    setStatus("failed");
    setMessage(text);
  };

  const needsWorkspace = () => {
    if (workspaceId) return false;
    fail("You are not signed in to a workspace, so there is nowhere to save this.");
    return true;
  };

  const submitStudent = async () => {
    const fieldErrors = validateDraft({ kind: "student", track, title, subject });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    if (needsWorkspace()) return;

    setStatus("saving");
    setMessage(null);
    const result = await createStudent({
      workspaceId: workspaceId!,
      track,
      fullName: title,
      target: subject,
    });

    if (result.ok) return close();
    fail(result.error);
    if (result.field === "target") setErrors({ subject: result.error });
  };

  const submitLesson = async () => {
    if (!studentId) return fail("Choose which learner this lesson is for.");
    if (!startsAt) return fail("Choose when the lesson starts.");
    if (needsWorkspace()) return;

    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return fail("That start time is not valid.");
    const end = new Date(start.getTime() + duration * 60 * 1000);

    setStatus("saving");
    setMessage(null);
    const result = await scheduleLesson({
      workspaceId: workspaceId!,
      studentId,
      track,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      title: title.trim() || undefined,
    });

    if (result.ok) return close();
    fail(result.error);
  };

  const submitHomework = async () => {
    if (!studentId) return fail("Choose which learner this is for.");
    if (!title.trim()) {
      setErrors({ title: "Give the assignment a title." });
      return;
    }
    if (needsWorkspace()) return;

    setStatus("saving");
    setMessage(null);
    const result = await assignHomework({
      workspaceId: workspaceId!,
      studentId,
      track,
      title,
      // A date input gives midnight local; due end-of-day is what a teacher means.
      dueAt: dueAt ? new Date(`${dueAt}T23:59`).toISOString() : undefined,
    });

    if (result.ok) return close();
    fail(result.error);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (kind === "student") return submitStudent();
    if (kind === "lesson") return submitLesson();
    if (kind === "homework") return submitHomework();
  };

  const heading = HEADINGS[kind][track];
  const saving = status === "saving";

  /** Shared: a learner chooser, or an explanation of why there is none. */
  const studentField = (
    <label>
      <span>{track === "ESL" ? "Learner" : "Candidate"}</span>
      {trackStudents.length === 0 ? (
        <p className="create-modal-pending" role="status">
          <AlertCircle size={15} />
          <span>
            No {track} {track === "ESL" ? "learners" : "candidates"} yet. Add one
            first — there is nobody to schedule for.
          </span>
        </p>
      ) : (
        <select
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
        >
          <option value="">Choose…</option>
          {trackStudents.map((student) => (
            <option key={student.studentId} value={student.studentId}>
              {student.name}
            </option>
          ))}
        </select>
      )}
    </label>
  );

  const canSubmit =
    kind === "student" || (kind !== "assessment" && trackStudents.length > 0);

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="create-modal"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="create-modal-head">
          <div>
            <span className="eyebrow">{track} workspace</span>
            <h2>{heading}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {kind === "assessment" ? (
          <div className="create-modal-body">
            <p className="create-modal-pending" role="status">
              <AlertCircle size={15} />
              <span>
                This screen is not built yet. Recording{" "}
                {track === "ESL" ? "a progress check" : "a mock result"} needs a
                set of criteria to score against —{" "}
                {track === "ESL"
                  ? "CEFR mastery across each language system"
                  : "the four official band criteria"}{" "}
                — which is more than this form can ask for. It will live in
                Assessments.
              </span>
            </p>
            <div className="create-modal-actions">
              <button type="button" className="primary-button" onClick={close}>
                Understood <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form className="create-modal-body" onSubmit={submit} noValidate>
            {kind === "student" && (
              <>
                <label className={errors.title ? "has-error" : ""}>
                  <span>
                    {track === "ESL" ? "Learner name" : "Candidate name"}
                  </span>
                  <input
                    ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Full name"
                    aria-invalid={Boolean(errors.title)}
                  />
                  {errors.title && <small role="alert">{errors.title}</small>}
                </label>

                <label className={errors.subject ? "has-error" : ""}>
                  <span>{SUBJECT_LABELS.student[track]}</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={track === "ESL" ? "B1" : "7.0"}
                    aria-invalid={Boolean(errors.subject)}
                  />
                  {errors.subject && (
                    <small role="alert">{errors.subject}</small>
                  )}
                </label>
              </>
            )}

            {kind === "lesson" && (
              <>
                {studentField}
                <label>
                  <span>Starts</span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                  />
                </label>
                <label>
                  <span>Length</span>
                  <select
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  >
                    {DURATIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Title (optional)</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={
                      track === "ESL"
                        ? "Past simple storytelling"
                        : "Writing Task 2"
                    }
                  />
                </label>
              </>
            )}

            {kind === "homework" && (
              <>
                {studentField}
                <label className={errors.title ? "has-error" : ""}>
                  <span>Assignment</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={
                      track === "ESL"
                        ? "Unit 6 vocabulary practice"
                        : "Timed Task 2 response"
                    }
                    aria-invalid={Boolean(errors.title)}
                  />
                  {errors.title && <small role="alert">{errors.title}</small>}
                </label>
                <label>
                  <span>Due (optional)</span>
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </label>
              </>
            )}

            {status === "failed" && message && (
              <p className="create-modal-error" role="alert">
                <AlertCircle size={15} />
                <span>{message}</span>
              </p>
            )}

            <div className="create-modal-actions">
              <button type="button" className="secondary-button" onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving || !canSubmit}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    {kind === "lesson" ? "Schedule" : "Create"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
