"use client";

/**
 * The nine-stage lesson lifecycle (CLAUDE.md rule 4).
 *
 * Shown only when a lesson is actually scheduled. As a static diagram over an
 * empty workspace it is decoration; against a real lesson it tells the teacher
 * where they are in the loop, which is a decision aid.
 *
 * The current stage is derived from the lesson itself (see
 * `deriveWorkflowStage`) rather than stored, so it cannot disagree with the
 * prep checklist beside it.
 */

import { Check } from "lucide-react";

import { PanelHeader } from "@/components/primitives";
import { stageArea, stageState, workflowStages } from "@/lib/navigation/workflow";
import type { DeepLink } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";

export function WorkflowStrip({
  track,
  studentName,
  currentStage,
  navigate,
}: {
  track: Track;
  studentName: string;
  currentStage: number | null;
  navigate: (link: DeepLink) => void;
}) {
  return (
    <article className="panel workflow-panel">
      <PanelHeader
        kicker={`${track} lesson lifecycle`}
        title={`${studentName}’s class workflow`}
        action={
          <span className="stage-pill">
            {currentStage === null
              ? "Not started"
              : `Step ${currentStage + 1} of ${workflowStages.length}`}
          </span>
        }
      />
      <div className="workflow-line">
        {workflowStages.map((step, index) => {
          const Icon = step.icon;
          const state = stageState(index, currentStage);
          return (
            <button
              key={step.label}
              className={`workflow-step ${state}`}
              onClick={() => navigate({ area: stageArea(index, track) })}
            >
              <span>
                <Icon size={16} />
                {state === "done" && (
                  <i>
                    <Check size={10} />
                  </i>
                )}
              </span>
              <small>{step.label}</small>
              {index < workflowStages.length - 1 && <b />}
            </button>
          );
        })}
      </div>
    </article>
  );
}
