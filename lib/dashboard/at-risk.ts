/**
 * Feature 4 — at-risk / attention students.
 *
 * Turns the dashboard into triage. A count of active learners tells the teacher
 * nothing they can act on; a list of who is slipping, and why, does.
 *
 * TRACK SEPARATION
 * ----------------
 * Stall detection is deliberately different per track and must stay that way
 * (CLAUDE.md rule 5). A stalled ESL learner is one whose CEFR mastery has not
 * moved; a stalled IELTS candidate is one whose overall band has not moved
 * while a test date approaches. Those are different measurements on different
 * scales, and one shared "progress stalled" rule would be wrong for both.
 *
 * Every threshold below is named and exported so the rules stay reviewable —
 * these are pedagogical judgements, not implementation details, and the teacher
 * should be able to argue with them.
 */

import type { StudentSignal } from "@/lib/types/domain";
import type {
  AtRiskStudent,
  RiskFlag,
  RiskSeverity,
} from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";
import { calendarDaysSince, parseIso } from "./time";

/** No lesson, submission or sign-in for this many days. */
export const INACTIVE_DAYS = 7;

/** Missed assignments at which a learner becomes high severity. */
export const MISSED_HOMEWORK_HIGH = 3;
/** Missed assignments at which a learner is worth watching. */
export const MISSED_HOMEWORK_WATCH = 1;

/** No recorded progress change for this many days counts as stalled. */
export const STALLED_PROGRESS_DAYS = 21;

/** An IELTS test within this many days raises severity when below target. */
export const TEST_APPROACHING_DAYS = 30;

/** ESL mastery movement below this (percentage points) counts as flat. */
export const MASTERY_STALL_DELTA = 2;

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, watch: 1 };

function inactivityFlag(signal: StudentSignal, now: Date): RiskFlag | null {
  const lastActive = parseIso(signal.lastActiveAt);
  if (!lastActive) {
    return {
      reason: "inactive",
      severity: "watch",
      detail: "No recorded activity yet",
    };
  }
  const days = calendarDaysSince(lastActive, now);
  if (days < INACTIVE_DAYS) return null;
  return {
    reason: "inactive",
    severity: days >= INACTIVE_DAYS * 2 ? "high" : "watch",
    detail: `Inactive for ${days} days`,
  };
}

function missedHomeworkFlag(signal: StudentSignal): RiskFlag | null {
  if (signal.missedHomework < MISSED_HOMEWORK_WATCH) return null;
  return {
    reason: "missed-homework",
    severity: signal.missedHomework >= MISSED_HOMEWORK_HIGH ? "high" : "watch",
    detail: `${signal.missedHomework} assignment${signal.missedHomework === 1 ? "" : "s"} missed`,
  };
}

/** ESL: CEFR mastery has not moved. */
function stalledMasteryFlag(signal: StudentSignal, now: Date): RiskFlag | null {
  const history = signal.masteryHistory;
  if (!history || history.length < 2) return null;

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const moved = Math.abs(latest - previous) >= MASTERY_STALL_DELTA;
  if (moved) return null;

  const lastProgress = parseIso(signal.lastProgressAt);
  const days = lastProgress ? calendarDaysSince(lastProgress, now) : null;
  if (days !== null && days < STALLED_PROGRESS_DAYS) return null;

  return {
    reason: "stalled-mastery",
    severity: "watch",
    detail:
      days === null
        ? `Mastery flat at ${latest}%`
        : `Mastery flat at ${latest}% for ${days} days`,
  };
}

/** IELTS: overall band has not moved, weighted by how close the test is. */
function stalledBandFlag(signal: StudentSignal, now: Date): RiskFlag | null {
  const history = signal.bandHistory;
  if (!history || history.length < 2) return null;

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  if (latest > previous) return null;

  const target = signal.targetBand;
  const belowTarget = target !== undefined && latest < target;
  if (!belowTarget) return null;

  const testDate = parseIso(signal.testDate ?? null);
  const daysToTest = testDate ? calendarDaysSince(now, testDate) : null;
  const urgent =
    daysToTest !== null && daysToTest >= 0 && daysToTest <= TEST_APPROACHING_DAYS;

  const gap = (target - latest).toFixed(1);
  return {
    reason: "stalled-band",
    severity: urgent ? "high" : "watch",
    detail: urgent
      ? `Band ${latest.toFixed(1)}, ${gap} below target, test in ${daysToTest} days`
      : `Band ${latest.toFixed(1)} not moving, ${gap} below target`,
  };
}

/** IELTS: a test is close and the candidate is still short of target. */
function testApproachingFlag(signal: StudentSignal, now: Date): RiskFlag | null {
  const testDate = parseIso(signal.testDate ?? null);
  const target = signal.targetBand;
  const history = signal.bandHistory;
  if (!testDate || target === undefined || !history?.length) return null;

  const days = calendarDaysSince(now, testDate);
  if (days < 0 || days > TEST_APPROACHING_DAYS) return null;

  const latest = history[history.length - 1];
  if (latest >= target) return null;

  return {
    reason: "test-approaching",
    severity: "high",
    detail: `Test in ${days} days, currently ${latest.toFixed(1)} of ${target.toFixed(1)}`,
  };
}

/** Evaluates every rule for one learner. */
export function flagsFor(signal: StudentSignal, now: Date): RiskFlag[] {
  const flags = [
    missedHomeworkFlag(signal),
    inactivityFlag(signal, now),
    signal.track === "ESL"
      ? stalledMasteryFlag(signal, now)
      : stalledBandFlag(signal, now),
    signal.track === "IELTS" ? testApproachingFlag(signal, now) : null,
  ];
  return flags.filter((flag): flag is RiskFlag => flag !== null);
}

/**
 * Builds the triage list for one track, most urgent first.
 *
 * Ranking: high severity before watch, then more flags before fewer — a learner
 * failing on three fronts needs attention before one failing on a single count.
 */
export function buildAtRiskStudents(
  signals: StudentSignal[],
  track: Track,
  now: Date,
): AtRiskStudent[] {
  return signals
    .filter((signal) => signal.track === track)
    .map((signal): AtRiskStudent | null => {
      const flags = flagsFor(signal, now);
      if (!flags.length) return null;

      const severity: RiskSeverity = flags.some((flag) => flag.severity === "high")
        ? "high"
        : "watch";

      return {
        studentId: signal.studentId,
        name: signal.name,
        initials: signal.initials,
        tone: signal.tone,
        track: signal.track,
        flags,
        severity,
        score: SEVERITY_RANK[severity] * 100 - flags.length,
        link: { area: "Students" as const, detail: signal.name },
      };
    })
    .filter((student): student is AtRiskStudent => student !== null)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}
