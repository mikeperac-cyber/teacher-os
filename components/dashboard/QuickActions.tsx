"use client";

/**
 * The quick-action row and its modal.
 *
 * "Add learner" performs a real write through `createStudent`, a server action
 * that goes through Row Level Security like every other write.
 *
 * The other three actions do not have a form yet, because they genuinely need
 * more than two fields: scheduling needs a student and a time, assigning
 * homework needs a student and a due date, recording an assessment needs a
 * student and a set of criteria. Rather than show a form that cannot succeed,
 * the modal says what is missing and points at where the work will live. The
 * previous version reported "created successfully" for a write that never
 * happened; an honest gap is better than a convincing lie.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import type { ElementType } from "react";

import { createStudent } from "@/lib/actions/workflow";
import {
  SUBJECT_LABELS,
  validateDraft,
  type FieldErrors,
  type RecordKind,
} from "@/lib/actions/create-record";
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
    label: { ESL: "Plan lesson", IELTS: "Plan lesson" },
    hint: { ESL: "Plan from a CEFR outcome", IELTS: "Plan from a target band" },
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
}: {
  track: Track;
  workspaceId: string | null;
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
          close={() => setOpenKind(null)}
        />
      )}
    </>
  );
}

const HEADINGS: Record<RecordKind, Record<Track, string>> = {
  student: { ESL: "New ESL learner", IELTS: "New IELTS candidate" },
  lesson: { ESL: "Plan an ESL lesson", IELTS: "Plan an IELTS lesson" },
  homework: { ESL: "Assign ESL homework", IELTS: "Assign IELTS practice" },
  assessment: { ESL: "Record a progress check", IELTS: "Record a mock result" },
};

/** What each unbuilt screen still needs, stated plainly. */
const NOT_BUILT: Record<
  Exclude<RecordKind, "student">,
  { needs: string; lives: string }
> = {
  lesson: {
    needs: "a student to teach and a time to teach them",
    lives: "the Lesson Planner",
  },
  homework: {
    needs: "a student, a task and a due date",
    lives: "the Homework board",
  },
  assessment: {
    needs: "a student and a set of criteria to score against",
    lives: "Assessments",
  },
};

export function CreateRecordModal({
  kind,
  track,
  workspaceId,
  close,
}: {
  kind: RecordKind;
  track: Track;
  workspaceId: string | null;
  close: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "failed" | "saved">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const draft = { kind, track, title, subject };
    const fieldErrors = validateDraft(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    if (!workspaceId) {
      setStatus("failed");
      setMessage(
        "You are not signed in to a workspace, so there is nowhere to save this.",
      );
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await createStudent({
      workspaceId,
      track,
      fullName: title,
      target: subject,
    });

    if (result.ok) {
      setStatus("saved");
      setMessage(null);
      // The server action revalidates, so closing reveals the new learner.
      close();
      return;
    }

    setStatus("failed");
    setMessage(result.error);
    if (result.field === "target") setErrors({ subject: result.error });
  };

  const heading = HEADINGS[kind][track];

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

        {kind === "student" ? (
          <form className="create-modal-body" onSubmit={submit} noValidate>
            <label className={errors.title ? "has-error" : ""}>
              <span>{track === "ESL" ? "Learner name" : "Candidate name"}</span>
              <input
                ref={titleRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Full name"
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title && <small role="alert">{errors.title}</small>}
            </label>

            <label className={errors.subject ? "has-error" : ""}>
              <span>{SUBJECT_LABELS[kind][track]}</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={track === "ESL" ? "B1" : "7.0"}
                aria-invalid={Boolean(errors.subject)}
              />
              {errors.subject && <small role="alert">{errors.subject}</small>}
            </label>

            {status === "failed" && message && (
              <p className="create-modal-error" role="alert">
                <AlertCircle size={15} />
                <span>{message}</span>
              </p>
            )}

            {status === "saved" && (
              <p className="create-modal-notice" role="status">
                <CheckCircle2 size={15} />
                <span>Saved.</span>
              </p>
            )}

            <div className="create-modal-actions">
              <button type="button" className="secondary-button" onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={status === "saving"}
              >
                {status === "saving" ? (
                  <>
                    <Loader2 size={15} className="spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Create
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="create-modal-body">
            <p className="create-modal-pending" role="status">
              <AlertCircle size={15} />
              <span>
                This screen is not built yet. {heading} needs{" "}
                {NOT_BUILT[kind].needs}, which is more than this form can ask
                for — it will live in {NOT_BUILT[kind].lives}.
              </span>
            </p>
            <div className="create-modal-actions">
              <button type="button" className="secondary-button" onClick={close}>
                Close
              </button>
              <button type="button" className="primary-button" onClick={close}>
                Understood <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
