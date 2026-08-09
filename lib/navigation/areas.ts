/**
 * Area addressing.
 *
 * Product structure, not data. The slug form is the public URL contract
 * (`?track=esl&view=lesson-planner`) and is preserved through the migration —
 * existing bookmarks and deep links must keep working.
 */

import type { Area, Track } from "@/lib/types/ui";

export const allAreas: Area[] = [
  "Dashboard",
  "Today",
  "Students",
  "Lessons",
  "Lesson Planner",
  "Homework",
  "Assessments",
  "ESL Progress",
  "IELTS Progress",
  "Language Skills",
  "Writing Tracker",
  "Speaking Tracker",
  "Calendar",
  "Tasks",
  "Goals",
  "Projects",
  "Reports",
  "Materials",
];

export const areaSlug = (area: Area) => area.toLowerCase().replace(/\s+/g, "-");

export const areaFromSlug = (slug: string | null) =>
  allAreas.find((area) => areaSlug(area) === slug);

/** The progress area belonging to a track. The two are never interchangeable. */
export const progressAreaFor = (track: Track): Area =>
  track === "ESL" ? "ESL Progress" : "IELTS Progress";
