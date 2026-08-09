/**
 * Homework board. Empty until Supabase is connected — see ./README.md.
 *
 * The four columns mirror stages 2, 3 and 7 of the teaching workflow in
 * CLAUDE.md: homework status, homework checking and homework assignment.
 */

import type { HomeworkBoard, HomeworkColumn } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** Column order. Advancing a card always moves it one step to the right. */
export const HOMEWORK_COLUMNS: readonly HomeworkColumn[] = [
  "assigned",
  "submitted",
  "checking",
  "returned",
] as const;

export const HOMEWORK_COLUMN_LABELS: Record<HomeworkColumn, string> = {
  assigned: "Assigned",
  submitted: "Submitted",
  checking: "Checking",
  returned: "Returned",
};

const emptyBoard = (): HomeworkBoard => ({
  assigned: [],
  submitted: [],
  checking: [],
  returned: [],
});

/**
 * Backed by `homework_assignments`, `homework_submissions` and
 * `homework_feedback`. Note that moving a card between columns is a state
 * transition on the submission record, and in Phase 3 it becomes an authorized
 * server action — not a client-side array move.
 */
export const homeworkBoardByTrack: Record<Track, HomeworkBoard> = {
  ESL: emptyBoard(),
  IELTS: emptyBoard(),
};
