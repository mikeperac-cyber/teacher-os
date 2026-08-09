/**
 * Feature 8 — derived, clickable stats.
 *
 * Two changes from the tiles these replace.
 *
 * 1. **Derived, not declared.** Every figure is computed from the records in
 *    the data seam. When the seam is empty the count is a real zero, and a
 *    figure that needs records to mean anything reports "—" rather than an
 *    invented number. The tiles the demo shipped with contradicted each other:
 *    the header claimed 18 active students while the directory held 8.
 *
 * 2. **Every tile is a route.** A count nobody can act on is a vanity metric,
 *    so each stat carries the filtered destination that explains it.
 *
 * ESL and IELTS expose different stats because they are different products:
 * CEFR mastery has no meaning for a band candidate, and band gain has none for
 * a CEFR learner.
 */

import {
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  TrendingUp,
  Users,
} from "lucide-react";

import type {
  PendingAssessment,
  PendingHomework,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";
import type { DashboardStat } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";
import { isSameDay, parseIso } from "./time";

/** Shown when a figure needs records that do not exist yet. */
export const NO_VALUE = "—";

export type StatInputs = {
  signals: StudentSignal[];
  lessons: UpcomingLesson[];
  homework: PendingHomework[];
  assessments: PendingAssessment[];
};

function lessonsToday(lessons: UpcomingLesson[], track: Track, now: Date): number {
  return lessons.filter((lesson) => {
    if (lesson.track !== track) return false;
    const start = parseIso(lesson.startsAt);
    return start !== null && isSameDay(start, now);
  }).length;
}

/** Mean of the most recent reading per learner, or null when there is none. */
function averageLatest(values: Array<number[] | undefined>): number | null {
  const latest = values
    .map((history) => history?.[history.length - 1])
    .filter((value): value is number => typeof value === "number");
  if (!latest.length) return null;
  return latest.reduce((sum, value) => sum + value, 0) / latest.length;
}

export function buildStats(
  { signals, lessons, homework, assessments }: StatInputs,
  track: Track,
  now: Date,
): DashboardStat[] {
  const trackSignals = signals.filter((signal) => signal.track === track);
  const trackHomework = homework.filter((item) => item.track === track);
  const trackAssessments = assessments.filter((item) => item.track === track);
  const today = lessonsToday(lessons, track, now);

  const studentStat: DashboardStat = {
    id: "students",
    label: track === "ESL" ? "Active ESL students" : "IELTS candidates",
    value: String(trackSignals.length),
    note: trackSignals.length
      ? `${trackSignals.length} in this workspace`
      : track === "ESL"
        ? "No learners yet"
        : "No candidates yet",
    tone: track === "ESL" ? "mint" : "violet",
    icon: Users,
    link: { area: "Students" },
    pending: false,
  };

  const lessonStat: DashboardStat = {
    id: "lessons-today",
    label: `${track} lessons today`,
    value: String(today),
    note: today ? "Scheduled today" : "Nothing scheduled",
    tone: "blue",
    icon: BookOpen,
    link: { area: "Today" },
    pending: false,
  };

  if (track === "ESL") {
    const averageMastery = averageLatest(
      trackSignals.map((signal) => signal.masteryHistory),
    );
    return [
      studentStat,
      lessonStat,
      {
        id: "homework-to-check",
        label: "Homework to check",
        value: String(trackHomework.length),
        note: trackHomework.length
          ? `${trackHomework.filter((item) => item.dueAt && parseIso(item.dueAt)! < now).length} overdue`
          : "Nothing submitted",
        tone: "amber",
        icon: ClipboardCheck,
        link: { area: "Homework" },
        pending: false,
      },
      {
        id: "cefr-mastery",
        label: "CEFR mastery",
        value:
          averageMastery === null ? NO_VALUE : `${Math.round(averageMastery)}%`,
        note:
          averageMastery === null
            ? "Needs progress records"
            : `Across ${trackSignals.length} learners`,
        tone: "mint",
        icon: TrendingUp,
        link: { area: "ESL Progress" },
        pending: averageMastery === null,
      },
    ];
  }

  const averageBand = averageLatest(
    trackSignals.map((signal) => signal.bandHistory),
  );

  return [
    studentStat,
    lessonStat,
    {
      id: "mocks-to-score",
      label: "Mocks to score",
      value: String(trackAssessments.length),
      note: trackAssessments.length ? "Awaiting band scores" : "Nothing to mark",
      tone: "amber",
      icon: FileCheck2,
      link: { area: "Assessments" },
      pending: false,
    },
    {
      id: "average-band",
      label: "Average overall band",
      value: averageBand === null ? NO_VALUE : averageBand.toFixed(1),
      note:
        averageBand === null
          ? "Needs at least one scored mock"
          : `Across ${trackSignals.length} candidates`,
      tone: "violet",
      icon: Gauge,
      link: { area: "IELTS Progress" },
      pending: averageBand === null,
    },
  ];
}
