"use client";

/**
 * Feature 4 — at-risk / attention students.
 *
 * Every learner shown carries the reason they were flagged. A name with no
 * reason is a vanity count wearing a warning colour; the reason is what makes
 * this triage.
 *
 * Rules and thresholds live in `lib/dashboard/at-risk.ts` and differ per track
 * by design (CLAUDE.md rule 5).
 */

import { ArrowRight, ChevronRight, Users } from "lucide-react";

import { EmptyState, PanelHeader } from "@/components/primitives";
import type { AtRiskStudent, DeepLink } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";

export function AtRiskPanel({
  track,
  students,
  navigate,
  limit = 4,
}: {
  track: Track;
  students: AtRiskStudent[];
  navigate: (link: DeepLink) => void;
  limit?: number;
}) {
  const shown = students.slice(0, limit);
  const remaining = students.length - shown.length;
  const high = students.filter((student) => student.severity === "high").length;

  return (
    <article className="panel at-risk-panel">
      <PanelHeader
        kicker={track === "ESL" ? "ESL attention" : "IELTS test risk"}
        title="Needs intervention"
        action={
          students.length > 0 ? (
            <span className={`risk-count ${high ? "is-high" : ""}`}>
              {students.length}
            </span>
          ) : undefined
        }
      />

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody flagged"
          hint={
            track === "ESL"
              ? "Learners with missed homework, flat mastery or 7+ days inactive appear here."
              : "Candidates with missed work, a stalled band or an approaching test appear here."
          }
        />
      ) : (
        <>
          <div className="at-risk-list">
            {shown.map((student) => (
              <button
                key={student.studentId}
                className={`at-risk-row ${student.severity}`}
                onClick={() => navigate(student.link)}
              >
                <span className={`avatar avatar-small avatar-${student.tone}`}>
                  {student.initials}
                </span>
                <span className="at-risk-copy">
                  <strong>{student.name}</strong>
                  <span className="at-risk-flags">
                    {student.flags.map((flag) => (
                      <em key={flag.reason} className={`risk-flag ${flag.severity}`}>
                        {flag.detail}
                      </em>
                    ))}
                  </span>
                </span>
                <span className={`risk-label ${student.severity === "watch" ? "medium" : ""}`}>
                  {student.severity === "high" ? "High" : "Watch"}
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>

          {remaining > 0 && (
            <button
              className="inbox-more"
              onClick={() => navigate({ area: "Students" })}
            >
              {remaining} more flagged <ArrowRight size={13} />
            </button>
          )}
        </>
      )}
    </article>
  );
}
