"use client";

/**
 * Feature 7 — goals due this week.
 *
 * Goals are agreed in one lesson and reviewed in a later one. The gap between
 * is where they quietly stop mattering, so reviews falling due — and any that
 * have already slipped — are surfaced before the next lesson rather than after.
 */

import { ChevronRight, Target } from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import { reviewLabel } from "@/lib/dashboard/goals-due";
import type { DeepLink, GoalDue } from "@/lib/types/dashboard";

export function GoalsDuePanel({
  goals,
  navigate,
  limit = 4,
}: {
  goals: GoalDue[];
  navigate: (link: DeepLink) => void;
  limit?: number;
}) {
  const shown = goals.slice(0, limit);
  const overdue = goals.filter((goal) => goal.overdue).length;

  return (
    <article className="panel goals-due-panel">
      <PanelHeader
        kicker="Goal reviews"
        title="Due this week"
        action={
          goals.length > 0 ? (
            <span className={`muted-count ${overdue ? "is-overdue" : ""}`}>
              {overdue ? `${overdue} overdue` : `${goals.length} due`}
            </span>
          ) : undefined
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No reviews due"
          hint="Student goals nearing their review date appear here so progress is not lost between lessons."
        />
      ) : (
        <div className="goals-due-list">
          {shown.map((goal) => (
            <button
              key={goal.id}
              className={`goals-due-row ${goal.overdue ? "is-overdue" : ""}`}
              onClick={() => navigate(goal.link)}
            >
              <span className={`avatar avatar-small avatar-${goal.tone}`}>
                {goal.studentInitials}
              </span>
              <span className="goals-due-copy">
                <strong>{goal.title}</strong>
                <small>
                  {goal.studentName} · {reviewLabel(goal)}
                </small>
                <i>
                  <em style={{ width: `${goal.progress}%` }} />
                </i>
              </span>
              <b>{goal.progress}%</b>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
