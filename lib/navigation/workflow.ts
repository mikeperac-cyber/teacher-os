/**
 * The teaching workflow.
 *
 * This is the product's central loop, defined verbatim by CLAUDE.md rule 4:
 *
 *   upcoming lesson → homework status → homework checking → lesson preparation
 *   → lesson delivery → post-class notes → homework assignment → progress
 *   update → next lesson preparation
 *
 * It is product structure, not demo data, so it survives the data erasure. The
 * stages must not be reordered or removed — the whole application is organized
 * around this sequence.
 *
 * `state` is the only part that is data: which stage the current lesson has
 * reached. It is derived per lesson in Phase 3; until then every stage is
 * "next" because no lesson exists.
 */

import {
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  MessageSquareText,
  NotebookPen,
  PenLine,
  TimerReset,
  TrendingUp,
  Video,
} from "lucide-react";
import type { ElementType } from "react";

import type { Area, Track } from "@/lib/types/ui";

export type WorkflowStageState = "done" | "current" | "next";

export type WorkflowStage = {
  label: string;
  icon: ElementType;
  /** The area this stage opens. Track-sensitive for the progress stage. */
  area: Area;
};

/** The nine stages, in order. Index 7 is track-dependent — see `stageArea`. */
export const workflowStages: WorkflowStage[] = [
  { label: "Upcoming", icon: CalendarDays, area: "Today" },
  { label: "HW status", icon: FileCheck2, area: "Homework" },
  { label: "Check HW", icon: ClipboardCheck, area: "Homework" },
  { label: "Prepare", icon: NotebookPen, area: "Lesson Planner" },
  { label: "Deliver", icon: Video, area: "Lessons" },
  { label: "Notes", icon: MessageSquareText, area: "Lessons" },
  { label: "Assign", icon: PenLine, area: "Homework" },
  { label: "Progress", icon: TrendingUp, area: "ESL Progress" },
  { label: "Next prep", icon: TimerReset, area: "Lesson Planner" },
];

/**
 * Resolve a stage's destination for a track.
 *
 * The progress stage is the one place the two tracks diverge inside the shared
 * workflow: ESL records CEFR mastery, IELTS records band movement.
 */
export const stageArea = (index: number, track: Track): Area => {
  const stage = workflowStages[index];
  if (!stage) return "Dashboard";
  if (stage.label === "Progress") {
    return track === "ESL" ? "ESL Progress" : "IELTS Progress";
  }
  return stage.area;
};

/**
 * Which stage the current lesson has reached.
 *
 * `null` means there is no lesson in flight — correct for an empty workspace.
 * Previously hard-coded to stage 4 of 9.
 */
export const currentWorkflowStage: number | null = null;

/** Render state for a stage, given the lesson's current position. */
export const stageState = (
  index: number,
  current: number | null,
): WorkflowStageState => {
  if (current === null) return "next";
  if (index < current) return "done";
  if (index === current) return "current";
  return "next";
};
