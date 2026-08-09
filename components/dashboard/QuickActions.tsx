"use client";

/**
 * Feature 5 — wired quick actions.
 *
 * Add Student, Plan Lesson, Assign Homework and Record Assessment previously
 * did nothing. Each now opens a real modal with real validation, wired to
 * `lib/actions/create-record.ts`.
 *
 * Persistence is still missing, and the modal says so plainly instead of
 * reporting success. Every other part is finished: the fields, the validation,
 * the submitting state, the error surface and the labels that change per track.
 * When Supabase lands, only the body of `createRecord` changes.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
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
  SUBJECT_LABELS,
  createRecord,
  validateDraft,
} from "@/lib/actions/create-record";
import type { FieldErrors, RecordKind } from "@/lib/actions/create-record";
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
    hint: {
      ESL: "Plan from a CEFR outcome",
      IELTS: "Plan from a target band",
    },
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

export function QuickActions({ track }: { track: Track }) {
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
          close={() => setOpenKind(null)}
        />
      )}
    </>
  );
}

const TITLE_LABELS: Record<RecordKind, string> = {
  student: "Student name",
  lesson: "Lesson title",
  homework: "Assignment title",
  assessment: "Assessment title",
};

const HEADINGS: Record<RecordKind, Record<Track, string>> = {
  student: { ESL: "New ESL learner", IELTS: "New IELTS candidate" },
  lesson: { ESL: "Plan an ESL lesson", IELTS: "Plan an IELTS lesson" },
  homework: { ESL: "Assign ESL homework", IELTS: "Assign IELTS practice" },
  assessment: { ESL: "Record a progress check", IELTS: "Record a mock result" },
};

/**
 * Exported so the topbar's Quick add menu opens the same modal.
 *
 * Two entry points, one write path — otherwise "Add student" would mean
 * something different depending on which button the teacher reached for.
 */
export function CreateRecordModal({
  kind,
  track,
  close,
}: {
  kind: RecordKind;
  track: Track;
  close: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
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
    const draft = { kind, track, title, subject, note };

    const fieldErrors = validateDraft(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    setStatus("saving");
    setMessage(null);
    const result = await createRecord(draft);

    if (result.ok) {
      close();
      return;
    }
    setStatus("failed");
    setMessage(result.message);
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="create-modal"
        role="dialog"
        aria-modal="true"
        aria-label={HEADINGS[kind][track]}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="create-modal-head">
          <div>
            <span className="eyebrow">{track} workspace</span>
            <h2>{HEADINGS[kind][track]}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="create-modal-body" onSubmit={submit} noValidate>
          <label className={errors.title ? "has-error" : ""}>
            <span>{TITLE_LABELS[kind]}</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                kind === "student" ? "Full name" : "Something you will recognise later"
              }
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <small role="alert">{errors.title}</small>}
          </label>

          <label className={errors.subject ? "has-error" : ""}>
            <span>{SUBJECT_LABELS[kind][track]}</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={
                track === "ESL" ? "A2 → B1 · confident speaking" : "6.0 → 7.0 · Writing"
              }
              aria-invalid={Boolean(errors.subject)}
            />
            {errors.subject && <small role="alert">{errors.subject}</small>}
          </label>

          <label>
            <span>Next action (optional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What should happen next?"
            />
          </label>

          {/* Honest failure. The previous drawer reported "created successfully"
              for a write that never happened; a teacher would have lost the
              record and only discovered it after a refresh. */}
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
      </div>
    </div>
  );
}
