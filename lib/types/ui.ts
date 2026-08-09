/**
 * UI-structural types.
 *
 * These describe the shape of the *product*, not the shape of teaching data:
 * which workspaces exist, which areas each one exposes, and how navigation is
 * addressed. Nothing here is demo data, and nothing here becomes a database
 * table.
 *
 * Teaching records live in `lib/types/domain.ts`.
 */

import type { ElementType } from "react";

/**
 * The two teaching tracks.
 *
 * ESL and IELTS Academic are separate tracking systems with different progress
 * models, assessments and reports. This is a product invariant (CLAUDE.md rule
 * 1-2, 5) — it is never collapsed into a single generic "course" or a shared
 * score.
 */
export type Track = "ESL" | "IELTS";

/** Every addressable workspace area. Serialized into the `view` URL parameter. */
export type Area =
  | "Dashboard"
  | "Today"
  | "Students"
  | "Lessons"
  | "Lesson Planner"
  | "Homework"
  | "Assessments"
  | "ESL Progress"
  | "IELTS Progress"
  | "Language Skills"
  | "Writing Tracker"
  | "Speaking Tracker"
  | "Calendar"
  | "Tasks"
  | "Goals"
  | "Projects"
  | "Reports"
  | "Materials";

/**
 * Colour token used across avatars, meters, status pills and cards.
 * Maps to the `--violet` / `--blue` / `--mint` / `--amber` custom properties
 * defined in `app/globals.css`.
 */
export type Tone = "violet" | "blue" | "mint" | "amber";

export type NavItem = {
  name: Area;
  label: string;
  icon: ElementType;
  /**
   * Pending-work count. Always derived from live data — never hard-coded.
   * Undefined means "nothing pending", which is also the correct state for an
   * empty workspace.
   */
  badge?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Editorial copy for an area header.
 *
 * `eyebrow`, `title` and `description` are product copy and are authored here.
 * `stats` and `items` are *data* and must come from queries — they are shipped
 * empty and are the responsibility of whatever renders the area.
 */
export type AreaMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

/** A headline figure on an area header, e.g. ["Active", "18"]. */
export type AreaStat = { label: string; value: string };

export type DestinationMode =
  | "detail"
  | "create"
  | "notifications"
  | "profile"
  | "delivery";

export type DestinationPanel = {
  title: string;
  eyebrow: string;
  description: string;
  area: Area;
  mode: DestinationMode;
  facts: Array<[string, string]>;
  related: Area[];
};

/** Surfaces a transient confirmation message. */
export type Announce = (message: string, openPanel?: boolean) => void;

/**
 * The signed-in teacher.
 *
 * Populated from Supabase Auth in Phase 2. `null` means "not signed in", which
 * is the only correct value until authentication exists.
 */
export type CurrentUser = {
  displayName: string;
  initials: string;
  role: string;
};
