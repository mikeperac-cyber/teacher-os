/**
 * Feature 7 — goals due this week.
 *
 * Student goals are agreed in one lesson and reviewed in a later one. The gap
 * between is where they quietly stop mattering. This surfaces the reviews
 * falling due so a goal is revisited while it is still current.
 *
 * Overdue reviews are included and sort first: a review that has already
 * slipped is the exact failure this feature exists to prevent.
 */

import type { ScheduledGoalReview } from "@/lib/types/domain";
import type { GoalDue } from "@/lib/types/dashboard";
import type { Track } from "@/lib/types/ui";
import { calendarDaysSince, parseIso } from "./time";

/** Reviews falling within this many days are surfaced. */
export const REVIEW_HORIZON_DAYS = 7;

export function buildGoalsDue(
  reviews: ScheduledGoalReview[],
  track: Track,
  now: Date,
  horizonDays = REVIEW_HORIZON_DAYS,
): GoalDue[] {
  return reviews
    .filter((review) => review.track === track)
    .map((review): GoalDue | null => {
      const reviewDate = parseIso(review.reviewDueAt);
      if (!reviewDate) return null;

      const daysUntilReview = calendarDaysSince(now, reviewDate);
      if (daysUntilReview > horizonDays) return null;

      return {
        id: review.id,
        studentName: review.studentName,
        studentInitials: review.studentInitials,
        tone: review.tone,
        title: review.title,
        reviewDueAt: review.reviewDueAt,
        daysUntilReview,
        overdue: daysUntilReview < 0,
        progress: review.progress,
        link: { area: "Goals" as const, detail: review.studentName },
      };
    })
    .filter((goal): goal is GoalDue => goal !== null)
    .sort((a, b) => a.daysUntilReview - b.daysUntilReview);
}

/** Label for a review's timing, e.g. "Overdue by 2 days", "Due today". */
export function reviewLabel(goal: GoalDue): string {
  if (goal.daysUntilReview < 0) {
    const days = Math.abs(goal.daysUntilReview);
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (goal.daysUntilReview === 0) return "Due today";
  if (goal.daysUntilReview === 1) return "Due tomorrow";
  return `Due in ${goal.daysUntilReview} days`;
}
