"use client";

/**
 * Features 1 and 2 — next-up lesson and prep checklist.
 *
 * These are one panel because they answer one question: is the next lesson
 * ready, and if not, what is stopping it. Splitting them would put the problem
 * and its cause in different places on the screen.
 *
 * The four one-click destinations — plan, materials, last notes, student — are
 * the things a teacher otherwise hunts for in the minutes before class.
 */

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  FileText,
  MessageSquareText,
  NotebookPen,
  Play,
  UserRound,
  Zap,
} from "lucide-react";

import { EmptyState } from "@/components/primitives";
import { countdownLabel } from "@/lib/dashboard/time";
import type { DeepLink, NextUpLesson, PrepStatus } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";

export function NextUpPanel({
  track,
  lesson,
  prep,
  navigate,
  onStartLesson,
}: {
  track: Track;
  lesson: NextUpLesson | null;
  prep: PrepStatus;
  navigate: (link: DeepLink) => void;
  onStartLesson: () => void;
}) {
  const toneClass = track === "ESL" ? "esl" : "ielts";

  if (!lesson) {
    return (
      <article className={`track-hero-card ${toneClass} next-up-card is-empty`}>
        <div className="track-hero-top">
          <span>
            <Zap size={14} fill="currentColor" /> NEXT {track} LESSON
          </span>
        </div>
        <div className="next-up-empty">
          <h2>No lesson scheduled</h2>
          <p>
            {track === "ESL"
              ? "Add an ESL learner and schedule their first lesson to start the teaching workflow."
              : "Add a candidate with a target band and test date, then schedule their first lesson."}
          </p>
          <div className="next-up-actions">
            <button onClick={() => navigate({ area: "Students" })}>
              <UserRound size={15} /> Add {track === "ESL" ? "learner" : "candidate"}
            </button>
            <button onClick={() => navigate({ area: "Calendar" })}>
              Schedule a lesson <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`track-hero-card ${toneClass} next-up-card`}>
      <div className="track-hero-top">
        <span>
          <Zap size={14} fill="currentColor" />
          {lesson.inProgress
            ? `${track} LESSON IN PROGRESS`
            : `NEXT ${track} LESSON · ${countdownLabel(lesson.minutesUntil).toUpperCase()}`}
        </span>
        <span className="track-hero-badge">{lesson.timeLabel}</span>
      </div>

      <div className="next-up-body">
        <span className={`avatar avatar-large avatar-${lesson.tone}`}>
          {lesson.studentInitials}
        </span>
        <div className="next-up-identity">
          <h2>{lesson.studentName}</h2>
          <p>{lesson.courseLabel}</p>
        </div>
        <div
          className="readiness-ring"
          style={{ "--progress": String(prep.readiness) } as React.CSSProperties}
        >
          <strong>{prep.readiness}%</strong>
          <span>ready</span>
        </div>
      </div>

      <div className="next-up-objective">
        <span>{track === "ESL" ? "Communicative outcome" : "Band objective"}</span>
        <p>{lesson.objective ?? "No objective set — the lesson has no target yet."}</p>
      </div>

      {/* Blockers lead. A schedule says a lesson is coming; this says why it is
          not ready, which is the only part that changes what the teacher does. */}
      {prep.blockers.length > 0 && (
        <div className="prep-blockers">
          <p className="prep-blockers-head">
            <AlertTriangle size={14} />
            {prep.blockers.length} blocker{prep.blockers.length === 1 ? "" : "s"} before
            this lesson
          </p>
          {prep.blockers.map((item) => (
            <button
              key={item.id}
              className="prep-blocker"
              onClick={() => navigate(item.link)}
            >
              <Circle size={13} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      )}

      <div className="prep-list">
        {prep.items.map((item) => (
          <button
            key={item.id}
            className={`prep-item ${item.ready ? "is-ready" : ""} ${item.blocking ? "is-blocking" : ""}`}
            onClick={() => navigate(item.link)}
            title={item.detail}
          >
            {item.ready ? <Check size={13} /> : <Circle size={13} />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="next-up-footer">
        <div className="next-up-links">
          <button onClick={() => navigate(lesson.links.plan)}>
            <NotebookPen size={15} /> Plan
          </button>
          <button onClick={() => navigate(lesson.links.materials)}>
            <FileText size={15} /> Materials
            {lesson.materialCount > 0 && <b>{lesson.materialCount}</b>}
          </button>
          <button
            onClick={() => navigate(lesson.links.lastNotes)}
            disabled={!lesson.lastNotes}
            title={lesson.lastNotes ?? "No notes from the previous lesson"}
          >
            <MessageSquareText size={15} /> Last notes
          </button>
          <button onClick={() => navigate(lesson.links.student)}>
            <BookOpen size={15} /> Student
          </button>
        </div>
        <button className="next-up-start" onClick={onStartLesson}>
          <Play size={15} fill="currentColor" />
          {lesson.inProgress ? "Resume lesson" : "Start lesson"}
        </button>
      </div>
    </article>
  );
}

/** Standalone prep checklist, for when no lesson is scheduled. */
export function PrepChecklistEmpty({ track }: { track: Track }) {
  return (
    <EmptyState
      icon={NotebookPen}
      title="Nothing to prepare"
      hint={`Readiness is calculated from the preparation steps of your next ${track} lesson.`}
    />
  );
}
