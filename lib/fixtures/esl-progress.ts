/**
 * ESL progress — CEFR mastery and independent use.
 * Empty until Supabase is connected — see ./README.md.
 *
 * DO NOT merge this with `ielts-progress.ts`. CEFR mastery is a 0–100
 * percentage describing how reliably a learner can use a language system;
 * an IELTS band is a 0–9 examiner judgement against fixed descriptors. They are
 * not convertible, and collapsing them into one "score" destroys both
 * (CLAUDE.md rule 5).
 */

import type {
  EslProgressRow,
  EslPulseRow,
  EslSystemScore,
  LanguageSystemRow,
} from "@/lib/types/domain";

/** CEFR skill matrix. Backed by `esl_progress_entries` + `cefr_assessments`. */
export const eslProgressRows: EslProgressRow[] = [];

/** Dashboard CEFR pulse table. */
export const eslPulseRows: EslPulseRow[] = [];

/** Language-system meters on the dashboard rail. */
export const eslSystemScores: EslSystemScore[] = [];

/**
 * Recognition / controlled / independent evidence per language system.
 * The gap between recognition and independent use is the core ESL diagnostic.
 * Backed by `language_outcomes` + `vocabulary_mastery`.
 */
export const languageSystemRows: LanguageSystemRow[] = [];

/**
 * CEFR level distribution across the cohort: [level, learners].
 * Derived by aggregate query, never stored.
 */
export const cefrDistribution: Array<[level: string, count: number]> = [
  ["A1", 0],
  ["A2", 0],
  ["B1", 0],
  ["B2", 0],
  ["C1", 0],
];
