/**
 * IELTS Academic progress — band scores against official criteria.
 * Empty until Supabase is connected — see ./README.md.
 *
 * DO NOT merge this with `esl-progress.ts`. See that file's header for why.
 *
 * Score arrays here are positional and follow the official criterion order
 * declared in `lib/types/domain.ts`. Reordering them silently corrupts every
 * candidate's record.
 */

import type {
  IeltsBandRow,
  IeltsSkillAverage,
  IeltsSpeakingRow,
  IeltsWritingRow,
  SpeakingPartAverage,
  WritingErrorPattern,
} from "@/lib/types/domain";

/** Band matrix: Listening, Reading, Writing, Speaking. Backed by `ielts_skill_scores`. */
export const ieltsBandRows: IeltsBandRow[] = [];

/** Cohort averages per skill, for the dashboard rail. */
export const ieltsSkillAverages: IeltsSkillAverage[] = [];

/** Writing criterion bands. Backed by `ielts_writing_scores`. */
export const ieltsWritingRows: IeltsWritingRow[] = [];

/** Speaking criterion bands. Backed by `ielts_speaking_scores`. */
export const ieltsSpeakingRows: IeltsSpeakingRow[] = [];

/** Recurring errors suppressing Writing bands, aggregated from marked scripts. */
export const writingErrorPatterns: WritingErrorPattern[] = [];

/** Average band by Speaking part, aggregated from scored recordings. */
export const speakingPartAverages: SpeakingPartAverage[] = [];
