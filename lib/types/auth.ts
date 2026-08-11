/**
 * Session and role types.
 *
 * `WorkspaceSession` is a discriminated union rather than a nullable object
 * because "no session" has four genuinely different causes, and the interface
 * should say which one applies. Collapsing them to null produces the classic
 * unhelpful screen that cannot tell a missing config from a missing login.
 */

export type WorkspaceRole = "owner" | "teacher" | "student";

/**
 * Initials for an avatar, from a display name or an email local-part.
 *
 * Lives here rather than in `lib/auth/session.ts` because that module is
 * `server-only` and this is a pure string function worth testing directly.
 */
export function initialsFrom(name: string): string {
  const source = name.includes("@") ? name.split("@")[0] : name;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type WorkspaceSession =
  /** No Supabase project is configured yet. Nobody can sign in. */
  | { status: "unconfigured" }
  /** Configured, but this request carries no valid session. */
  | { status: "signed-out" }
  /**
   * Signed in, but belonging to no workspace. Correct for a brand-new account:
   * every policy is scoped by membership, so this user can see nothing until an
   * owner adds them.
   */
  | {
      status: "no-workspace";
      userId: string;
      email: string;
      displayName: string;
      initials: string;
    }
  /** Signed in with an active workspace membership. */
  | {
      status: "active";
      userId: string;
      email: string;
      displayName: string;
      initials: string;
      workspaceId: string;
      workspaceName: string;
      role: WorkspaceRole;
    };

/** The identity the shell renders in the sidebar. */
export type ShellUser = {
  displayName: string;
  initials: string;
  /** Rendered under the name, e.g. "Owner · My teaching". */
  subtitle: string;
  signedIn: boolean;
};

/** Collapses a session into what the sidebar needs. */
export function shellUserFrom(session: WorkspaceSession): ShellUser {
  switch (session.status) {
    case "unconfigured":
      // Kept short: the sidebar slot is narrow and truncates. The full
      // explanation is on the sign-in screen, where there is room for it.
      return {
        displayName: "Not connected",
        initials: "",
        subtitle: "No database yet",
        signedIn: false,
      };
    case "signed-out":
      return {
        displayName: "Not signed in",
        initials: "",
        subtitle: "Sign in to continue",
        signedIn: false,
      };
    case "no-workspace":
      return {
        displayName: session.displayName,
        initials: session.initials,
        subtitle: "No workspace yet",
        signedIn: true,
      };
    case "active":
      return {
        displayName: session.displayName,
        initials: session.initials,
        subtitle: `${roleLabel(session.role)} · ${session.workspaceName}`,
        signedIn: true,
      };
  }
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
  }
}

/* ------------------------------------------------------------------ */
/* Auth form state                                                     */
/* ------------------------------------------------------------------ */

/**
 * What the sign-in / sign-up form renders after a submit.
 *
 * Lives here rather than beside the actions because `lib/auth/actions.ts` is a
 * `"use server"` module, and every export from one of those must be an async
 * function. Exporting a plain object from it fails at module evaluation with
 * "A 'use server' file can only export async functions, found object" — and
 * only when the route is actually rendered, so a passing build proves nothing.
 */
export type AuthFormState = {
  error: string | null;
  notice: string | null;
};

export const EMPTY_AUTH_STATE: AuthFormState = { error: null, notice: null };
