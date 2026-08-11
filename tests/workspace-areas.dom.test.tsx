// @vitest-environment jsdom

/**
 * Area wiring.
 *
 * The component tests in `teacher-loop.dom.test.tsx` render each new screen
 * directly, which proves the screen works and nothing about whether the shell
 * reaches it. A mistyped `case` in `DetailedArea`, a prop that never gets
 * threaded, a crash on mount — all of those pass a component test, pass `tsc`,
 * and pass `next build`, because the workspace route is dynamic and is never
 * evaluated at build time.
 *
 * That combination has bitten this project once already (`lib/auth/actions.ts`
 * exporting a constant, which only failed when the page was actually rendered).
 * So this renders the real shell and walks to each area.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Workspace } from "@/components/workspace/Workspace";
import { emptyTriage } from "@/lib/queries/shared";
import type { TriageData } from "@/lib/types/dashboard";
import type { PendingHomework, UpcomingLesson } from "@/lib/types/domain";

// Server actions need a request context; none of them is called here.
vi.mock("@/lib/actions/workflow", () => ({
  createStudent: vi.fn(),
  scheduleLesson: vi.fn(),
  saveLessonPlan: vi.fn(),
  assignHomework: vi.fn(),
  recordFeedback: vi.fn(),
  recordEslProgress: vi.fn(),
  recordIeltsBands: vi.fn(),
  createWorkspace: vi.fn(),
}));
vi.mock("@/lib/auth/actions", () => ({
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
  signOutAction: vi.fn(),
}));

const NOW = new Date(2026, 7, 10, 9, 0, 0);

const SHELL_USER = {
  displayName: "Test Teacher",
  initials: "TT",
  subtitle: "Owner · Test Workspace",
  signedIn: true,
};

const LESSON: UpcomingLesson = {
  id: "lesson-1",
  studentId: "student-1",
  studentName: "Ada Lovelace",
  studentInitials: "AL",
  tone: "violet",
  track: "ESL",
  courseLabel: "ESL",
  startsAt: new Date(2026, 7, 10, 19, 0).toISOString(),
  endsAt: new Date(2026, 7, 10, 20, 0).toISOString(),
  objective: null,
  hasPlan: false,
  plannedBlocks: 0,
  homeworkReturned: true,
  goalsReviewedAt: null,
  lastNotes: null,
};

const SUBMISSION: PendingHomework = {
  id: "submission-1",
  studentId: "student-1",
  studentName: "Ada Lovelace",
  studentInitials: "AL",
  tone: "amber",
  track: "ESL",
  task: "Unit 6 vocabulary",
  body: "My answers for unit 6.",
  dueAt: new Date(2026, 7, 11, 9, 0).toISOString(),
  blocksLessonId: null,
  minutes: 20,
};

const triage = (over: Partial<TriageData> = {}): TriageData => ({
  ...emptyTriage(),
  upcomingLessons: [LESSON],
  pendingHomework: [SUBMISSION],
  studentSignals: [
    {
      studentId: "student-1",
      name: "Ada Lovelace",
      initials: "AL",
      tone: "violet",
      track: "ESL",
      lastActiveAt: null,
      missedHomework: 0,
      lastProgressAt: null,
      hasLogin: false,
    },
    {
      studentId: "student-2",
      name: "Grace Hopper",
      initials: "GH",
      tone: "blue",
      track: "IELTS",
      lastActiveAt: null,
      missedHomework: 0,
      lastProgressAt: null,
      hasLogin: false,
    },
  ],
  ...over,
});

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(cleanup);

const setup = (data: TriageData = triage()) =>
  render(
    <Workspace
      shellUser={SHELL_USER}
      workspaceId="workspace-1"
      triage={data}
      nowIso={NOW.toISOString()}
    />,
  );

/** Clicks a left-hand navigation entry by its label. */
const goTo = (label: string) => {
  const sidebar = document.querySelector("aside") as HTMLElement;
  fireEvent.click(within(sidebar).getByText(label));
};

/** Flips the ESL / IELTS Academic switch in the sidebar. */
const switchToIelts = () => {
  const switcher = document.querySelector(".track-switcher") as HTMLElement;
  fireEvent.click(within(switcher).getByText("IELTS"));
};

describe("the workspace reaches every teacher-loop screen", () => {
  it("opens the lesson planner with the scheduled lesson loaded", () => {
    setup();
    goTo("ESL Planner");
    expect(screen.getByText("CEFR learning outcome")).toBeDefined();
    expect(screen.getByText("60-minute lesson flow")).toBeDefined();
    // Threaded from triage, not from a fixture.
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
  });

  it("opens homework checking with the submitted work loaded", () => {
    setup();
    goTo("ESL Homework");
    expect(screen.getByText("What they submitted")).toBeDefined();
    expect(screen.getByText("My answers for unit 6.")).toBeDefined();
  });

  it("opens ESL progress with the mastery entry panel", () => {
    setup();
    goTo("CEFR Progress");
    expect(screen.getByText("Record progress")).toBeDefined();
    expect(screen.getByLabelText("Grammar")).toBeDefined();
  });

  it("opens IELTS progress with the band entry panel", () => {
    setup();
    switchToIelts();
    goTo("Band Progress");
    expect(screen.getByText("Record bands")).toBeDefined();
    expect(screen.getByLabelText("Listening")).toBeDefined();
  });

  /**
   * The tracks are separate systems, so the ESL learner must not be offered
   * a band and the IELTS candidate must not be offered a CEFR percentage.
   */
  it("keeps the two progress models apart", () => {
    setup();
    goTo("CEFR Progress");
    expect(screen.queryByText("Record bands")).toBeNull();

    switchToIelts();
    goTo("Band Progress");
    expect(screen.queryByText("Record progress")).toBeNull();
    const picker = screen.getByLabelText("Candidate") as HTMLSelectElement;
    const names = Array.from(picker.options).map((option) => option.text);
    expect(names).toContain("Grace Hopper");
    expect(names).not.toContain("Ada Lovelace");
  });

  it("survives an empty workspace on every new screen", () => {
    for (const area of ["ESL Planner", "ESL Homework", "CEFR Progress"]) {
      setup(emptyTriage());
      goTo(area);
      cleanup();
    }
    // Reaching here without throwing is the assertion; make it explicit.
    expect(true).toBe(true);
  });

  it("keeps the URL contract when navigating to a new screen", () => {
    setup();
    goTo("ESL Planner");
    expect(window.location.search).toBe("?track=esl&view=lesson-planner");
  });
});
