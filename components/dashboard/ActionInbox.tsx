"use client";

/**
 * Feature 3 — action inbox.
 *
 * One prioritized queue replacing three competing lists (homework to grade,
 * assessments to record, overdue tasks). Ranking lives in
 * `lib/dashboard/action-inbox.ts`; this component only renders it.
 *
 * Items that block the next lesson are visually separated, because "do this or
 * the next class goes badly" is a different instruction from "this is late".
 */

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

import { EmptyState } from "@/components/primitives";
import { PanelHeader } from "@/components/primitives";
import { totalMinutes } from "@/lib/dashboard/action-inbox";
import type { ActionItem, DeepLink } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";

const KIND_LABEL: Record<ActionItem["kind"], string> = {
  homework: "Homework",
  assessment: "Assessment",
  task: "Task",
};

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function ActionInbox({
  track,
  items,
  navigate,
  limit = 6,
}: {
  track: Track;
  items: ActionItem[];
  navigate: (link: DeepLink) => void;
  limit?: number;
}) {
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;
  const minutes = totalMinutes(items);
  const blocking = items.filter((item) => item.blocksNextLesson);

  return (
    <article className="panel action-inbox-panel">
      <PanelHeader
        kicker={`${track} action inbox`}
        title="What needs you now"
        action={
          items.length > 0 ? (
            <span className="muted-count">
              {items.length} item{items.length === 1 ? "" : "s"}
              {minutes > 0 && ` · ~${minutesLabel(minutes)}`}
            </span>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Inbox clear"
          hint="Homework to grade, assessments to record and overdue tasks arrive here together."
        />
      ) : (
        <>
          {blocking.length > 0 && (
            <p className="inbox-blocking-note">
              <AlertTriangle size={13} />
              {blocking.length} item{blocking.length === 1 ? "" : "s"} must be done
              before your next lesson
            </p>
          )}

          <div className="inbox-list">
            {shown.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`inbox-row ${item.blocksNextLesson ? "is-blocking" : ""} ${item.overdue ? "is-overdue" : ""}`}
                  onClick={() => navigate(item.link)}
                >
                  <span className={`inbox-icon ${item.tone}`}>
                    <Icon size={16} />
                  </span>
                  <span className="inbox-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <span className="inbox-meta">
                    <em className="inbox-kind">{KIND_LABEL[item.kind]}</em>
                    <span className={`inbox-due ${item.overdue ? "overdue" : ""}`}>
                      <Clock3 size={12} />
                      {item.dueLabel}
                    </span>
                  </span>
                  {item.minutes !== null && (
                    <span className="time-chip">{minutesLabel(item.minutes)}</span>
                  )}
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>

          {remaining > 0 && (
            <button
              className="inbox-more"
              onClick={() => navigate({ area: "Tasks" })}
            >
              {remaining} more in the queue <ArrowRight size={13} />
            </button>
          )}
        </>
      )}
    </article>
  );
}
