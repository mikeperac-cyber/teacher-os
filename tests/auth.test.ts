/**
 * Session shape and how it renders in the shell.
 *
 * The property worth pinning down is that "no session" has four distinct
 * causes and the interface says which one applies. Collapsing them to a single
 * null produces the screen that cannot tell a missing config from a missing
 * login, and someone then spends an hour debugging the wrong thing.
 */

import { describe, expect, it } from "vitest";

import { initialsFrom, roleLabel, shellUserFrom } from "@/lib/types/auth";
import type { WorkspaceSession } from "@/lib/types/auth";

describe("initialsFrom", () => {
  it("takes the first letter of each of the first two words", () => {
    expect(initialsFrom("Ada Lovelace")).toBe("AL");
    expect(initialsFrom("Ada Byron King Lovelace")).toBe("AB");
  });

  it("uses a single initial for a one-word name", () => {
    expect(initialsFrom("Ada")).toBe("A");
  });

  it("uses the local part of an email, not the domain", () => {
    expect(initialsFrom("ada.lovelace@example.com")).toBe("AL");
    expect(initialsFrom("ada@example.com")).toBe("A");
  });

  it("splits on dots, underscores and hyphens as well as spaces", () => {
    expect(initialsFrom("ada_lovelace")).toBe("AL");
    expect(initialsFrom("ada-lovelace")).toBe("AL");
  });

  it("never returns an empty string", () => {
    expect(initialsFrom("")).toBe("?");
    expect(initialsFrom("   ")).toBe("?");
  });
});

describe("roleLabel", () => {
  it("renders each role", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("teacher")).toBe("Teacher");
    expect(roleLabel("student")).toBe("Student");
  });
});

describe("shellUserFrom", () => {
  it("distinguishes an unconfigured install from a signed-out one", () => {
    const unconfigured = shellUserFrom({ status: "unconfigured" });
    const signedOut = shellUserFrom({ status: "signed-out" });

    expect(unconfigured.displayName).not.toBe(signedOut.displayName);
    expect(unconfigured.signedIn).toBe(false);
    expect(signedOut.signedIn).toBe(false);
  });

  it("reports a signed-in user with no workspace as signed in", () => {
    const shell = shellUserFrom({
      status: "no-workspace",
      userId: "u1",
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      initials: "AL",
    });

    expect(shell.signedIn).toBe(true);
    expect(shell.displayName).toBe("Ada Lovelace");
    expect(shell.subtitle).toMatch(/workspace/i);
  });

  it("shows role and workspace for an active session", () => {
    const shell = shellUserFrom({
      status: "active",
      userId: "u1",
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      initials: "AL",
      workspaceId: "w1",
      workspaceName: "My teaching",
      role: "owner",
    });

    expect(shell.signedIn).toBe(true);
    expect(shell.subtitle).toBe("Owner · My teaching");
  });

  /**
   * The sidebar slot is narrow and truncates, so a long label there is a real
   * defect rather than a cosmetic one.
   */
  it("keeps the signed-out labels short enough for the sidebar", () => {
    for (const status of ["unconfigured", "signed-out"] as const) {
      const shell = shellUserFrom({ status });
      expect(shell.displayName.length).toBeLessThanOrEqual(20);
      expect(shell.subtitle.length).toBeLessThanOrEqual(24);
    }
  });

  it("never claims a signed-out user is signed in", () => {
    const sessions: WorkspaceSession[] = [
      { status: "unconfigured" },
      { status: "signed-out" },
    ];
    for (const session of sessions) {
      expect(shellUserFrom(session).signedIn).toBe(false);
    }
  });
});
