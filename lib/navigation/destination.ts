/**
 * @deprecated Scheduled for removal in Phase 3.
 *
 * This module picks a destination area by keyword-matching the English text of
 * a confirmation message. It was the demo's navigation mechanism, and it works
 * only because every message was authored to contain a matching keyword.
 *
 * It is retained unchanged for now because Phase 1 is defined by not changing
 * behaviour. Do not extend it, do not add keywords, and do not translate the
 * strings it matches on — it is replaced by explicit routes as each area gains
 * real data.
 *
 * Why it must go:
 *  - untranslatable: matching depends on English substrings;
 *  - untestable: correctness depends on copy nobody treats as code;
 *  - silently wrong: new copy without a matching keyword lands on Dashboard.
 */

import type { Area, DestinationMode, DestinationPanel, Track } from "@/lib/types/ui";

/** Editorial copy describing what each area's detail view offers. */
export const destinationCopy: Record<Area, string> = {
  Dashboard:
    "Review the teaching system, priorities and next actions connected to this item.",
  Today: "See the scheduled time, readiness state and the next action for today.",
  Students:
    "Open the learner record with goals, attendance, lessons, homework and current priorities.",
  Lessons:
    "Open the full lesson record, teaching notes, materials and follow-up workflow.",
  "Lesson Planner":
    "Continue the timed lesson flow, attached materials and pre-class readiness checks.",
  Homework:
    "Review the submission, feedback status, evidence of mastery and next assignment step.",
  Assessments:
    "Open the evidence, scoring criteria, feedback and intervention decision.",
  "ESL Progress":
    "Review CEFR evidence, independent use, confidence and the learner’s next language target.",
  "IELTS Progress":
    "Review skill bands, target gap, test date and the next score-building intervention.",
  "Language Skills":
    "Inspect recognition, controlled practice and independent production evidence.",
  "Writing Tracker":
    "Open the script, criterion bands, recurring errors and marking actions.",
  "Speaking Tracker":
    "Open the recording, criterion bands, part performance and scoring actions.",
  Calendar: "Open the schedule block, linked work and availability around it.",
  Tasks: "Open the task details, due time, priority and related teaching work.",
  Goals:
    "Review the target, progress evidence, milestones and next weekly action.",
  Projects:
    "Open the project board, milestones, tasks and current delivery risk.",
  Reports:
    "Open the complete report with filters, evidence and recommended decisions.",
  Materials:
    "Open the teaching resource, preview, level tags and lesson-use actions.",
};

/** @deprecated See module header. */
export function buildDestination(
  message: string,
  track: Track,
  fallbackArea: Area = "Dashboard",
): DestinationPanel {
  const lower = message.toLowerCase();
  let area: Area = fallbackArea;
  if (lower.includes("teacher profile")) area = "Dashboard";
  else if (
    lower.includes("material") ||
    lower.includes("collection") ||
    lower.includes("worksheet") ||
    lower.includes("cards") ||
    lower.includes("audio")
  )
    area = "Materials";
  else if (lower.includes("report opened")) area = "Reports";
  else if (
    lower.includes("writing") ||
    lower.includes("task 1") ||
    lower.includes("task 2") ||
    lower.includes("script")
  )
    area = "Writing Tracker";
  else if (
    lower.includes("speaking") ||
    lower.includes("recording") ||
    lower.includes("fluency")
  )
    area = "Speaking Tracker";
  else if (
    lower.includes("homework") ||
    lower.includes("assignment") ||
    lower.includes("workbook")
  )
    area = "Homework";
  else if (
    lower.includes("mock") ||
    lower.includes("assessment") ||
    lower.includes("score") ||
    lower.includes("mark")
  )
    area = "Assessments";
  else if (
    lower.includes("lesson plan") ||
    lower.includes("mini-plan") ||
    lower.includes("production plan") ||
    lower.includes("prep") ||
    lower.startsWith("create new esl lesson") ||
    lower.startsWith("create new ielts lesson")
  )
    area = "Lesson Planner";
  else if (
    lower.includes("lesson") ||
    lower.includes("class workflow") ||
    lower.includes("deliver")
  )
    area = "Lessons";
  else if (
    lower.includes("student") ||
    lower.includes("candidate") ||
    lower.includes("profile") ||
    lower.includes("learner")
  )
    area = "Students";
  else if (
    lower.includes("cefr") ||
    lower.includes("vocabulary") ||
    lower.includes("grammar") ||
    lower.includes("language skill")
  )
    area = track === "ESL" ? "ESL Progress" : "IELTS Progress";
  else if (
    lower.includes("band") ||
    lower.includes("readiness") ||
    lower.includes("intervention")
  )
    area = "IELTS Progress";
  else if (lower.includes("report")) area = "Reports";
  else if (lower.includes("project")) area = "Projects";
  else if (lower.includes("goal") || lower.includes("review")) area = "Goals";
  else if (
    lower.includes("calendar") ||
    lower.includes("event") ||
    lower.includes("block")
  )
    area = "Calendar";
  else if (lower.includes("task") || lower.includes("focus") || lower.includes("note"))
    area = "Tasks";
  else if (lower.includes("today") || lower.includes("day")) area = "Today";

  const mode: DestinationMode =
    lower.startsWith("create") || lower.startsWith("new ")
      ? "create"
      : lower.includes("notification")
        ? "notifications"
        : lower.includes("teacher profile")
          ? "profile"
          : lower.includes("delivery room") || lower.includes("lesson room")
            ? "delivery"
            : "detail";

  const title = message
    .replace(/\s+(opened|selected|started|created|refreshed|captured)$/i, "")
    .replace(/\s+opened for .+$/i, "")
    .replace(/\s+saved and marked ready$/i, "")
    .replace(/^new\s+/i, "Create ")
    .trim();

  const related: Area[] =
    area === "Students"
      ? [track === "ESL" ? "ESL Progress" : "IELTS Progress", "Lessons", "Homework"]
      : area === "Lessons" || area === "Lesson Planner"
        ? ["Lesson Planner", "Homework", "Materials"]
        : area === "Writing Tracker" ||
            area === "Speaking Tracker" ||
            area === "Assessments"
          ? ["IELTS Progress", "Assessments", "Reports"]
          : area === "Homework"
            ? [
                "Students",
                "Lesson Planner",
                track === "ESL" ? "ESL Progress" : "IELTS Progress",
              ]
            : [area, "Tasks", "Calendar"];

  return {
    title,
    eyebrow: `${track} · ${mode === "create" ? "New record" : area}`,
    description:
      mode === "create"
        ? `Create a new ${track} record and continue directly into its working screen.`
        : destinationCopy[area],
    area,
    mode,
    // Previously included a hard-coded owner name. Facts are now derived from
    // the record itself, and are empty until records exist.
    facts:
      mode === "create"
        ? [["Workspace", track], ["Status", "New draft"]]
        : [["Workspace", track], ["Status", lower.includes("complete") ? "Complete" : "Active"]],
    related: [...new Set(related)].slice(0, 3),
  };
}
