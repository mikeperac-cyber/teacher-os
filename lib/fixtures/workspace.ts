/**
 * Workspace-level state: who is signed in, and what search can find.
 * Empty until Supabase is connected — see ./README.md.
 */

import type { SearchResult } from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/*
 * NOTE: the signed-in user is no longer a fixture.
 *
 * It briefly lived here as `currentUser = null`, replacing the hard-coded
 * "Mike Teacher / Private tutor" from the original export. It is now resolved
 * server-side by `lib/auth/session.ts` from Supabase Auth and passed into the
 * shell as a prop — never from a constant, and never from a request header
 * (see ADR 0001 on the deleted `app/chatgpt-auth.ts`).
 */

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
