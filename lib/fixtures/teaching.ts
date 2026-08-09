/**
 * Scheduling, lesson history and lesson preparation.
 * Empty until Supabase is connected — see ./README.md.
 */

import type {
  CalendarEvent,
  DayBlock,
  LessonPlan,
  LessonRecord,
  ScheduledClass,
} from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** Today's lessons across both tracks. Backed by `lessons`. */
export const todaysClasses: ScheduledClass[] = [];

/** The chronological day timeline: lessons, prep, marking and admin. */
export const dayBlocksByTrack: Record<Track, DayBlock[]> = {
  ESL: [],
  IELTS: [],
};

/** Delivered-lesson history. Backed by `lessons` + `lesson_notes`. */
export const lessonRecordsByTrack: Record<Track, LessonRecord[]> = {
  ESL: [],
  IELTS: [],
};

/**
 * The lesson currently being prepared, per track.
 *
 * `null` means there is nothing to prepare — the correct state for a workspace
 * with no scheduled lessons, and what the planner's empty state renders from.
 * Backed by `lesson_plans`.
 */
export const activeLessonPlanByTrack: Record<Track, LessonPlan | null> = {
  ESL: null,
  IELTS: null,
};

/** Week-calendar entries. Backed by `calendar_events`. */
export const calendarEvents: CalendarEvent[] = [];

/**
 * Weekday column headers for the week grid.
 * Product structure, not data — but the dates themselves must be computed from
 * the viewed week rather than hard-coded, which is why no dates appear here.
 */
export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
