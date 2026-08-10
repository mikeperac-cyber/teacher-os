import "server-only";

/**
 * Helpers shared by the query modules.
 *
 * The queries here return the *same types the fixtures returned*. That is the
 * whole design: `lib/fixtures/` established the shape, the components were
 * built against it, and swapping a fixture for a query changes no component.
 * Anything that makes a query return a different shape is a step backwards.
 */

import type { Tone } from "@/lib/types/ui";
import { initialsFrom } from "@/lib/types/auth";
import type { TriageData } from "@/lib/types/dashboard";

const TONES: Tone[] = ["violet", "blue", "mint", "amber"];

/**
 * A stable colour for a record.
 *
 * Derived from the id rather than stored, so a learner keeps the same avatar
 * colour across sessions and devices without a column for it. Deterministic on
 * purpose — a colour that changed between renders would read as a different
 * person.
 */
export function toneFor(id: string): Tone {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

export { initialsFrom };

/**
 * Empty triage data, for when there is no session or no project.
 *
 * A function rather than a shared constant: callers spread it into a mutable
 * result, and a single frozen object would be a shared mutable reference across
 * requests waiting to be written to.
 */
export const emptyTriage = (): TriageData => ({
  upcomingLessons: [],
  studentSignals: [],
  pendingHomework: [],
  pendingAssessments: [],
  scheduledTasks: [],
  goalReviews: [],
  dayCapacities: [],
});
