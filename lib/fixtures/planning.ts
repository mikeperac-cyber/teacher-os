/**
 * Shared operational areas: tasks, goals and projects.
 * Empty until Supabase is connected — see ./README.md.
 *
 * These are shared across both tracks (CLAUDE.md rule 3) and, unlike teaching
 * records, are owned by the teacher rather than by a student. Students have no
 * access to them under the RLS matrix in ADR 0001.
 */

import type {
  GoalItem,
  PriorityItem,
  ProjectItem,
  TaskGroup,
} from "@/lib/types/domain";
import type { Track } from "@/lib/types/ui";

/** Dashboard priority queue, per track. Backed by `tasks`. */
export const priorityQueueByTrack: Record<Track, PriorityItem[]> = {
  ESL: [],
  IELTS: [],
};

/** Full task list, grouped by life area. Backed by `tasks`. */
export const taskGroups: TaskGroup[] = [];

/** Quarterly goals. Backed by `goals`. */
export const goals: GoalItem[] = [];

/** Projects. Backed by `projects`. */
export const projects: ProjectItem[] = [];

/** Project category filters, derived from the distinct categories in use. */
export const projectCategories: string[] = [];
