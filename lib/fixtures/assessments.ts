/**
 * Marking queue. Empty until Supabase is connected — see ./README.md.
 *
 * ESL assessments measure CEFR mastery and communicative performance.
 * IELTS assessments produce band scores against official criteria.
 * They share this queue view but never share a scoring model.
 */

import type { AssessmentItem } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** Backed by `assessments`, `ielts_mock_tests` and `cefr_assessments`. */
export const markingQueueByTrack: Record<Track, AssessmentItem[]> = {
  ESL: [],
  IELTS: [],
};

/** Scheduled progress checks (ESL) and mocks (IELTS). */
export const upcomingAssessmentsByTrack: Record<Track, AssessmentItem[]> = {
  ESL: [],
  IELTS: [],
};
