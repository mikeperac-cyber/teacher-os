/**
 * Teaching library and reporting.
 * Empty until Supabase is connected — see ./README.md.
 *
 * Materials carry uploaded files, so in Phase 5 this collection is backed by
 * Supabase Storage as well as Postgres. Buckets are private; downloads go
 * through server-generated signed URLs after an authorization check.
 */

import type {
  MaterialCollection,
  MaterialItem,
  ReportCard,
} from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** Teaching resources. Backed by `materials` + `files`. */
export const materials: MaterialItem[] = [];

/** Named material collections, per track. */
export const collectionsByTrack: Record<Track, MaterialCollection[]> = {
  ESL: [],
  IELTS: [],
};

/** Recently opened materials, per track. */
export const recentMaterialsByTrack: Record<Track, MaterialItem[]> = {
  ESL: [],
  IELTS: [],
};

/**
 * Available reports, per track.
 *
 * Empty because a report is only meaningful once there are records to report
 * on. ESL reports describe CEFR movement and production gaps; IELTS reports
 * describe band movement and rubric gaps. They are never the same report with
 * a different label.
 */
export const reportsByTrack: Record<Track, ReportCard[]> = {
  ESL: [],
  IELTS: [],
};

/** Lessons delivered per week over the reporting window. Aggregate query. */
export const weeklyLessonCountsByTrack: Record<Track, number[]> = {
  ESL: [],
  IELTS: [],
};

/** Skill filters offered in the material library, per track. */
export const materialSkillFiltersByTrack: Record<Track, string[]> = {
  ESL: ["All", "Speaking", "Grammar", "Vocabulary", "Listening", "Pronunciation"],
  IELTS: ["All", "Writing", "Speaking", "Reading", "Listening", "Assessment"],
};
