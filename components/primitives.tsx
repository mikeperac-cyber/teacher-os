"use client";

/**
 * Shared presentational primitives.
 *
 * Extracted from `app/page.tsx` so the dashboard triage panels and the area
 * screens render identical headers and empty states. Nothing here holds state
 * or knows about data.
 */

import { Inbox } from "lucide-react";
import type { ElementType, ReactNode } from "react";

/**
 * The state a screen is in before its records exist.
 *
 * Uses `.table-empty` from `app/globals.css` rather than introducing new
 * styling, so empty states read as part of the design system instead of as
 * something missing.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
}: {
  icon?: ElementType;
  title: string;
  hint: string;
}) {
  return (
    <div className="table-empty">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );
}

export function PanelHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Initials from a display name, for avatars. */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}
