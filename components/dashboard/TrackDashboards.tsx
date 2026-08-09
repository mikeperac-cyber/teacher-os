"use client";

/**
 * The two track dashboards.
 *
 * ESL and IELTS remain separate components (CLAUDE.md rule 2). They share the
 * triage *frame* — next-up lesson, action inbox, at-risk learners — because
 * that frame is the product's answer to "what needs me now", but every figure,
 * rule and label inside it is derived per track and free to diverge further.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * - No charts. Trends belong on Reports, where there is room to read them.
 * - No copy of the Today timeline. The dashboard links there instead of
 *   duplicating it, so there is one place that runs the day.
 *
 * The organising rule: decide and act in under 30 seconds.
 */

import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

import { ActionInbox } from "./ActionInbox";
import { AtRiskPanel } from "./AtRiskPanel";
import { CapacityStrip } from "./CapacityStrip";
import { GoalsDuePanel } from "./GoalsDuePanel";
import { NextUpPanel } from "./NextUpPanel";
import { QuickActions } from "./QuickActions";
import { StatTiles } from "./StatTiles";
import { WorkflowStrip } from "./WorkflowStrip";
import { useNow } from "./use-now";

import {
  buildActionInbox,
  buildAtRiskStudents,
  buildGoalsDue,
  buildNextUp,
  buildPrepChecklist,
  buildStats,
  buildWeekCapacity,
  deriveWorkflowStage,
  selectNextLesson,
} from "@/lib/dashboard";
import { EMPTY_WEEK } from "@/lib/dashboard/capacity";
import { NO_PREP } from "@/lib/dashboard/prep-checklist";
import {
  dayCapacities,
  goalReviews,
  pendingAssessments,
  pendingHomework,
  scheduledTasks,
  studentSignals,
  upcomingLessons,
} from "@/lib/fixtures";
import type { DeepLink } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";

export type TrackDashboardProps = {
  navigate: (link: DeepLink) => void;
  onStartLesson: () => void;
  announce: (message: string, openPanel?: boolean) => void;
};

/**
 * Runs every derivation for one track.
 *
 * Before mount `now` is null (see `useNow`), so the derivations are skipped and
 * every panel renders its empty state — which is also what they render when
 * there are genuinely no records.
 */
function useTrackTriage(track: Track) {
  const now = useNow();

  if (!now) {
    return {
      now: null,
      nextUp: null,
      prep: NO_PREP,
      inbox: [],
      atRisk: [],
      week: EMPTY_WEEK,
      goals: [],
      stats: [],
      workflowStage: null as number | null,
    };
  }

  const nextLesson = selectNextLesson(upcomingLessons, track, now);

  return {
    now,
    nextUp: buildNextUp(nextLesson, now),
    prep: buildPrepChecklist(nextLesson, now),
    workflowStage: deriveWorkflowStage(nextLesson, now),
    inbox: buildActionInbox(
      {
        homework: pendingHomework,
        assessments: pendingAssessments,
        tasks: scheduledTasks,
      },
      track,
      nextLesson?.id ?? null,
      now,
    ),
    atRisk: buildAtRiskStudents(studentSignals, track, now),
    week: buildWeekCapacity(upcomingLessons, dayCapacities, track, now),
    goals: buildGoalsDue(goalReviews, track, now),
    stats: buildStats(
      {
        signals: studentSignals,
        lessons: upcomingLessons,
        homework: pendingHomework,
        assessments: pendingAssessments,
      },
      track,
      now,
    ),
  };
}

function TrackDashboardLayout({
  track,
  heading,
  subheading,
  planLabel,
  navigate,
  onStartLesson,
  announce,
}: TrackDashboardProps & {
  track: Track;
  heading: string;
  subheading: string;
  planLabel: string;
}) {
  const { nextUp, prep, inbox, atRisk, week, goals, stats, workflowStage } =
    useTrackTriage(track);

  return (
    <>
      <section className="page-heading dashboard-heading track-heading">
        <div>
          <p className="eyebrow">
            <span className={`track-context-chip ${track.toLowerCase()}`}>
              {track === "ESL" ? "ESL · CEFR WORKSPACE" : "IELTS ACADEMIC WORKSPACE"}
            </span>
          </p>
          <h1>{heading}</h1>
          <p>{subheading}</p>
          <QuickActions track={track} />
        </div>
        <button className="secondary-button" onClick={() => announce(planLabel)}>
          <Sparkles size={16} /> {planLabel}
        </button>
      </section>

      <StatTiles stats={stats} navigate={navigate} />

      <section className="dashboard-grid track-dashboard">
        <div className="dashboard-main-column">
          <NextUpPanel
            track={track}
            lesson={nextUp}
            prep={prep}
            navigate={navigate}
            onStartLesson={onStartLesson}
          />

          {/* Only meaningful against a real lesson — see WorkflowStrip. */}
          {nextUp && (
            <WorkflowStrip
              track={track}
              studentName={nextUp.studentName}
              currentStage={workflowStage}
              navigate={navigate}
            />
          )}

          <ActionInbox track={track} items={inbox} navigate={navigate} />

          {/* The full day lives in Today. Linking beats duplicating it. */}
          <button
            className="inbox-more dashboard-today-link"
            onClick={() => navigate({ area: "Today" })}
          >
            <CalendarDays size={13} />
            Open the full {track} day in Today
            <ArrowRight size={13} />
          </button>
        </div>

        <aside className="dashboard-rail">
          <AtRiskPanel track={track} students={atRisk} navigate={navigate} />
          <CapacityStrip week={week} navigate={navigate} />
          <GoalsDuePanel goals={goals} navigate={navigate} />
        </aside>
      </section>
    </>
  );
}

export function ESLDashboard(props: TrackDashboardProps) {
  return (
    <TrackDashboardLayout
      {...props}
      track="ESL"
      heading="ESL teaching dashboard"
      subheading="Communicative outcomes, CEFR mastery and language development for your ESL learners."
      planLabel="Plan ESL day"
    />
  );
}

export function IELTSDashboard(props: TrackDashboardProps) {
  return (
    <TrackDashboardLayout
      {...props}
      track="IELTS"
      heading="IELTS performance dashboard"
      subheading="Band scores, mocks, rubric gaps and test readiness for your IELTS candidates."
      planLabel="Prioritize test risk"
    />
  );
}
