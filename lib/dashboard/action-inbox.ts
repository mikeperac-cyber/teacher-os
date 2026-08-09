/**
 * Feature 3 — action inbox.
 *
 * Homework to grade, assessments to record and overdue tasks used to be three
 * separate lists. They compete for one scarce resource — the teacher's time
 * before the next lesson — so they are ranked against each other rather than
 * shown side by side.
 *
 * RANKING
 * -------
 * Lower score sorts first. The tiers are deliberately far apart so that a
 * genuine blocker always outranks routine work, no matter how overdue the
 * routine work is:
 *
 *   0–99      blocks the next lesson
 *   100–199   overdue
 *   200–299   due today
 *   300+      scheduled later, or undated
 *
 * Within a tier, more overdue and higher priority sort first.
 */

import { ClipboardCheck, FileCheck2, ListTodo } from "lucide-react";

import type {
  PendingAssessment,
  PendingHomework,
  ScheduledTask,
} from "@/lib/types/domain";
import type { ActionItem } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";
import { dueLabel, isSameDay, minutesBetween, parseIso } from "./time";

const TIER_BLOCKS_LESSON = 0;
const TIER_OVERDUE = 100;
const TIER_TODAY = 200;
const TIER_LATER = 300;

const PRIORITY_WEIGHT: Record<string, number> = { High: 0, Medium: 3, Low: 6 };

/** Places an item in a tier and ranks it within that tier. */
function scoreAction({
  dueAt,
  blocksNextLesson,
  now,
  priorityWeight = 0,
}: {
  dueAt: string | null;
  blocksNextLesson: boolean;
  now: Date;
  priorityWeight?: number;
}): { score: number; overdue: boolean } {
  const due = parseIso(dueAt);
  const minutes = due ? minutesBetween(now, due) : null;
  const overdue = minutes !== null && minutes < 0;

  if (blocksNextLesson) {
    // Soonest blocker first.
    const urgency = minutes === null ? 50 : Math.max(0, Math.min(90, minutes / 10));
    return { score: TIER_BLOCKS_LESSON + urgency, overdue };
  }

  if (overdue) {
    // Most overdue first: more negative minutes → lower score.
    const overdueHours = Math.abs(minutes) / 60;
    return {
      score: TIER_OVERDUE + Math.max(0, 90 - Math.min(90, overdueHours)),
      overdue,
    };
  }

  if (due && minutes !== null && isSameDay(due, now)) {
    return { score: TIER_TODAY + priorityWeight + Math.min(60, minutes / 30), overdue };
  }

  return {
    score: TIER_LATER + priorityWeight + (minutes === null ? 90 : Math.min(90, minutes / 1440)),
    overdue,
  };
}

export function homeworkToActions(
  items: PendingHomework[],
  track: Track,
  nextLessonId: string | null,
  now: Date,
): ActionItem[] {
  return items
    .filter((item) => item.track === track)
    .map((item) => {
      const blocksNextLesson =
        item.blocksLessonId !== null && item.blocksLessonId === nextLessonId;
      const { score, overdue } = scoreAction({
        dueAt: item.dueAt,
        blocksNextLesson,
        now,
      });
      return {
        id: `homework:${item.id}`,
        kind: "homework" as const,
        title: item.task,
        subtitle: `${item.studentName} · ${track === "ESL" ? "Check mastery" : "Mark bands"}`,
        dueAt: item.dueAt,
        dueLabel: dueLabel(item.dueAt, now),
        overdue,
        blocksNextLesson,
        minutes: item.minutes,
        score,
        tone: item.tone,
        icon: ClipboardCheck,
        link: { area: "Homework" as const, detail: item.studentName },
      };
    });
}

export function assessmentsToActions(
  items: PendingAssessment[],
  track: Track,
  nextLessonId: string | null,
  now: Date,
): ActionItem[] {
  return items
    .filter((item) => item.track === track)
    .map((item) => {
      const blocksNextLesson =
        item.blocksLessonId !== null && item.blocksLessonId === nextLessonId;
      const { score, overdue } = scoreAction({
        dueAt: item.dueAt,
        blocksNextLesson,
        now,
      });
      return {
        id: `assessment:${item.id}`,
        kind: "assessment" as const,
        title: item.title,
        subtitle: `${item.studentName} · ${item.kind}`,
        dueAt: item.dueAt,
        dueLabel: dueLabel(item.dueAt, now),
        overdue,
        blocksNextLesson,
        minutes: item.minutes,
        score,
        tone: item.tone,
        icon: FileCheck2,
        link: { area: "Assessments" as const, detail: item.studentName },
      };
    });
}

/**
 * Tasks join the inbox only when they are overdue or due today.
 *
 * The full task list lives in Tasks. Pulling everything in would rebuild the
 * noise this feature exists to remove.
 */
export function tasksToActions(
  items: ScheduledTask[],
  track: Track,
  now: Date,
): ActionItem[] {
  return items
    .filter((item) => item.track === null || item.track === track)
    .filter((item) => {
      const due = parseIso(item.dueAt);
      if (!due) return false;
      return minutesBetween(now, due) < 0 || isSameDay(due, now);
    })
    .map((item) => {
      const { score, overdue } = scoreAction({
        dueAt: item.dueAt,
        blocksNextLesson: false,
        now,
        priorityWeight: PRIORITY_WEIGHT[item.priority] ?? 3,
      });
      return {
        id: `task:${item.id}`,
        kind: "task" as const,
        title: item.title,
        subtitle: item.detail,
        dueAt: item.dueAt,
        dueLabel: dueLabel(item.dueAt, now),
        overdue,
        blocksNextLesson: false,
        minutes: item.minutes,
        score,
        tone: item.tone,
        icon: ListTodo,
        link: { area: "Tasks" as const, detail: item.title },
      };
    });
}

/** Merges every source into one ranked queue. */
export function buildActionInbox(
  {
    homework,
    assessments,
    tasks,
  }: {
    homework: PendingHomework[];
    assessments: PendingAssessment[];
    tasks: ScheduledTask[];
  },
  track: Track,
  nextLessonId: string | null,
  now: Date,
): ActionItem[] {
  return [
    ...homeworkToActions(homework, track, nextLessonId, now),
    ...assessmentsToActions(assessments, track, nextLessonId, now),
    ...tasksToActions(tasks, track, now),
  ].sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
}

/** Total estimated minutes, for the "this is what's left" summary. */
export function totalMinutes(items: ActionItem[]): number {
  return items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
}
