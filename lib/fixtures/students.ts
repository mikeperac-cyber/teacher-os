/**
 * Learner records. Empty until Supabase is connected — see ./README.md.
 *
 * ESL learners and IELTS candidates are separate collections because they are
 * described by different fields: CEFR level and mastery versus current band,
 * target band and test date.
 */

import type {
  AttentionItem,
  IeltsCandidateRow,
  StudentPulse,
  StudentRow,
} from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** ESL learner directory. Backed by `students` + `esl_student_profiles`. */
export const eslStudents: StudentRow[] = [];

/** IELTS Academic candidate directory. Backed by `students` + `ielts_student_profiles`. */
export const ieltsCandidates: IeltsCandidateRow[] = [];

/** Dashboard progress-at-a-glance rail. */
export const studentPulse: StudentPulse[] = [];

/** Learners flagged for follow-up, per track. */
export const attentionByTrack: Record<Track, AttentionItem[]> = {
  ESL: [],
  IELTS: [],
};

/** Active learner count per track, for header statistics. Derived from a query. */
export const studentCountByTrack: Record<Track, number> = { ESL: 0, IELTS: 0 };
