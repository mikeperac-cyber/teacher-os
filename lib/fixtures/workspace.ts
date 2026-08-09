/**
 * Workspace-level state: who is signed in, and what search can find.
 * Empty until Supabase is connected — see ./README.md.
 */

import type { SearchResult } from "@/lib/types/domain";
import type { CurrentUser, Track } from "@/lib/types/ui";

/**
 * The signed-in teacher.
 *
 * `null` is correct and deliberate: there is no authentication yet, so there is
 * no user. It previously read "Mike Teacher / Private tutor", hard-coded into
 * the sidebar. Identity comes from Supabase Auth in Phase 2 — never from a
 * constant, and never from a request header (see ADR 0001 on
 * `app/chatgpt-auth.ts`).
 */
export const currentUser: CurrentUser | null = null;

/**
 * Global-search results.
 *
 * Search is scoped to the active track by design — a teacher looking for an
 * IELTS candidate should not match ESL learners. Once this is a real query it
 * is also scoped by RLS, so a teacher can only ever find their own assigned
 * students.
 */
export const searchResultsByTrack: Record<Track, SearchResult[]> = {
  ESL: [],
  IELTS: [],
};

/**
 * Weekly goal completion per track, 0–100.
 *
 * `null` means "not enough data to compute", which is the honest state for an
 * empty workspace. Previously hard-coded to 82% (ESL) and 71% (IELTS).
 */
export const weeklyGoalByTrack: Record<Track, number | null> = {
  ESL: null,
  IELTS: null,
};
