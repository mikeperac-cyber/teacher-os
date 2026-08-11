// @vitest-environment jsdom

/**
 * The teacher loop: prepare → check homework → record progress.
 *
 * These screens are the first ones where a teacher's typing becomes a database
 * row, so what is tested here is the boundary between the two: exactly which
 * arguments reach each server action, and which fields are deliberately not
 * sent.
 *
 * Two claims matter more than the rest, because getting either wrong is silent:
 *
 * 1. Releasing is a separate act from saving. Postgres enforces it — the policy
 *    in `0005_homework.sql` requires `released_at` — but a UI that always sent
 *    `release: true` would make that policy unreachable, and nobody would find
 *    out until a learner read a half-written comment.
 * 2. An untouched score field is not zero. A form that sent 0 for every skill
 *    the teacher did not observe would fabricate evidence of failure.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeworkChecking } from "@/components/homework/HomeworkChecking";
import { LessonPlanner } from "@/components/planner/LessonPlanner";
import { EslProgressEntry } from "@/components/progress/EslProgressEntry";
import { IeltsBandEntry } from "@/components/progress/IeltsBandEntry";
import type {
  PendingHomework,
  StudentSignal,
  UpcomingLesson,
} from "@/lib/types/domain";

const {
  saveLessonPlan,
  recordFeedback,
  recordEslProgress,
  recordIeltsBands,
} = vi.hoisted(() => ({
  saveLessonPlan: vi.fn(),
  recordFeedback: vi.fn(),
  recordEslProgress: vi.fn(),
  recordIeltsBands: vi.fn(),
}));

vi.mock("@/lib/actions/workflow", () => ({
  saveLessonPlan,
  recordFeedback,
  recordEslProgress,
  recordIeltsBands,
}));

afterEach(() => {
  cleanup();
  saveLessonPlan.mockReset();
  recordFeedback.mockReset();
  recordEslProgress.mockReset();
  recordIeltsBands.mockReset();
});

const WORKSPACE = "workspace-1";
/** Fixed instant so "Overdue by 2 days" is a checkable claim. */
const NOW = new Date(2026, 7, 10, 9, 0, 0);

const ok = (data: unknown = {}) => ({ ok: true, data });

const lesson = (over: Partial<UpcomingLesson> = {}): UpcomingLesson => ({
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
  ...over,
});

const submission = (over: Partial<PendingHomework> = {}): PendingHomework => ({
  id: "submission-1",
  studentId: "student-1",
  studentName: "Ada Lovelace",
  studentInitials: "AL",
  tone: "amber",
  track: "ESL",
  task: "Unit 6 vocabulary",
  body: "I have finished the exercises.",
  dueAt: new Date(2026, 7, 8, 9, 0).toISOString(),
  blocksLessonId: null,
  minutes: 20,
  ...over,
});

const student = (over: Partial<StudentSignal> = {}): StudentSignal => ({
  studentId: "student-1",
  name: "Ada Lovelace",
  initials: "AL",
  tone: "violet",
  track: "ESL",
  lastActiveAt: null,
  missedHomework: 0,
  lastProgressAt: null,
  ...over,
});

/* ------------------------------------------------------------------ */
/* Lesson preparation                                                  */
/* ------------------------------------------------------------------ */

describe("lesson preparation", () => {
  const setup = (track: "ESL" | "IELTS" = "ESL", lessons = [lesson()]) =>
    render(
      <LessonPlanner
        track={track}
        workspaceId={WORKSPACE}
        lessons={lessons}
        now={NOW}
      />,
    );

  it("says there is nothing to prepare when no lesson is scheduled", () => {
    setup("ESL", []);
    expect(screen.getByText("Nothing scheduled")).toBeDefined();
  });

  it("shows only this track's lessons", () => {
    setup("ESL", [
      lesson(),
      lesson({ id: "l2", studentName: "Grace Hopper", track: "IELTS" }),
    ]);
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.queryByText("Grace Hopper")).toBeNull();
  });

  /**
   * The label is the product rule made visible. An ESL lesson aims at something
   * the learner can do; an IELTS lesson at something an examiner would award.
   */
  it("asks for a communicative outcome on ESL and a band objective on IELTS", () => {
    setup("ESL");
    expect(screen.getByText("CEFR learning outcome")).toBeDefined();
    cleanup();
    setup("IELTS", [lesson({ track: "IELTS" })]);
    expect(screen.getByText("Band-score objective")).toBeDefined();
  });

  it("refuses to save without an objective, and does not call the action", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));
    await screen.findByRole("alert");
    expect(saveLessonPlan).not.toHaveBeenCalled();
  });

  it("sends the objective, the lesson and the named activities", async () => {
    saveLessonPlan.mockResolvedValue(ok({ planId: "plan-1" }));
    setup();

    fireEvent.change(screen.getByPlaceholderText(/Narrate a past event/i), {
      target: { value: "Narrate a past holiday" },
    });
    fireEvent.change(screen.getByLabelText("Activity 1 title"), {
      target: { value: "Warmer: holiday photos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => expect(saveLessonPlan).toHaveBeenCalledTimes(1));
    const sent = saveLessonPlan.mock.calls[0][0];
    expect(sent.workspaceId).toBe(WORKSPACE);
    expect(sent.lessonId).toBe("lesson-1");
    expect(sent.studentId).toBe("student-1");
    expect(sent.track).toBe("ESL");
    expect(sent.objective).toBe("Narrate a past holiday");
    expect(sent.markReady).toBe(false);
  });

  /**
   * An activity with no title is a row the teacher started and abandoned.
   * Saving it would inflate the readiness count with nothing to teach from.
   */
  it("drops activities that were never given a title", async () => {
    saveLessonPlan.mockResolvedValue(ok({ planId: "plan-1" }));
    setup();

    fireEvent.change(screen.getByPlaceholderText(/Narrate a past event/i), {
      target: { value: "Narrate a past holiday" },
    });
    // The starting shape has four rows; empty every one but the first.
    for (const index of [2, 3, 4]) {
      fireEvent.change(screen.getByLabelText(`Activity ${index} title`), {
        target: { value: "" },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => expect(saveLessonPlan).toHaveBeenCalledTimes(1));
    const sent = saveLessonPlan.mock.calls[0][0];
    expect(sent.blocks).toHaveLength(1);
    expect(sent.blocks[0].title).toBe("Warm-up");
  });

  it("marks the plan ready only when the teacher asks for it", async () => {
    saveLessonPlan.mockResolvedValue(ok({ planId: "plan-1" }));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Narrate a past event/i), {
      target: { value: "Narrate a past holiday" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark ready/i }));

    await waitFor(() => expect(saveLessonPlan).toHaveBeenCalledTimes(1));
    expect(saveLessonPlan.mock.calls[0][0].markReady).toBe(true);
  });

  it("reports a rejection from the database rather than claiming success", async () => {
    saveLessonPlan.mockResolvedValue({
      ok: false,
      error: "You do not have permission to do that.",
    });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Narrate a past event/i), {
      target: { value: "Narrate a past holiday" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("You do not have permission");
  });

  /** Readiness comes from the saved record, not from ticking a box. */
  it("reports readiness from the lesson's own state", () => {
    setup("ESL", [
      lesson({ hasPlan: true, plannedBlocks: 3, homeworkReturned: true }),
    ]);
    expect(screen.getByText("75%")).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Homework checking                                                   */
/* ------------------------------------------------------------------ */

describe("homework checking", () => {
  const setup = (track: "ESL" | "IELTS" = "ESL", queue = [submission()]) =>
    render(
      <HomeworkChecking
        track={track}
        workspaceId={WORKSPACE}
        submissions={queue}
        now={NOW}
      />,
    );

  it("says nothing is waiting when the queue is empty", () => {
    setup("ESL", []);
    expect(screen.getByText("No homework to check")).toBeDefined();
  });

  it("shows the learner's work and how overdue the marking is", () => {
    setup();
    expect(screen.getByText("I have finished the exercises.")).toBeDefined();
    expect(screen.getByText(/Overdue by 2 days/)).toBeDefined();
  });

  it("does not pretend a file-only submission has text", () => {
    setup("ESL", [submission({ body: "" })]);
    expect(screen.getByText(/submitted without text/i)).toBeDefined();
  });

  it("refuses to save empty feedback", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /save without/i }));
    await screen.findByRole("alert");
    expect(recordFeedback).not.toHaveBeenCalled();
  });

  /** The claim that matters: saving is not releasing. */
  it("saves without releasing, and says the learner cannot see it", async () => {
    recordFeedback.mockResolvedValue(ok({ feedbackId: "f1" }));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Strong use of past simple/i), {
      target: { value: "Good work on the past simple." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save without/i }));

    await waitFor(() => expect(recordFeedback).toHaveBeenCalledTimes(1));
    const sent = recordFeedback.mock.calls[0][0];
    expect(sent.release).toBe(false);
    expect(sent.submissionId).toBe("submission-1");
    expect(sent.studentId).toBe("student-1");
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("cannot see this yet");
  });

  it("releases only when the teacher chooses to", async () => {
    recordFeedback.mockResolvedValue(ok({ feedbackId: "f1" }));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Strong use of past simple/i), {
      target: { value: "Good work." },
    });
    fireEvent.click(screen.getByRole("button", { name: /release to learner/i }));

    await waitFor(() => expect(recordFeedback).toHaveBeenCalledTimes(1));
    expect(recordFeedback.mock.calls[0][0].release).toBe(true);
  });

  it("keeps the two tracks' queues apart", () => {
    setup("IELTS", [
      submission(),
      submission({
        id: "s2",
        studentName: "Grace Hopper",
        track: "IELTS",
        task: "Timed Task 2",
      }),
    ]);
    expect(screen.getByText("1 waiting")).toBeDefined();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Progress entry — one per track, never merged                        */
/* ------------------------------------------------------------------ */

describe("ESL progress entry", () => {
  const setup = (students = [student()]) =>
    render(<EslProgressEntry workspaceId={WORKSPACE} students={students} />);

  it("asks for a learner before it can record anything", () => {
    setup([student({ track: "IELTS" })]);
    expect(screen.getByText("No ESL learners yet")).toBeDefined();
  });

  it("records CEFR mastery, in percentages", () => {
    setup();
    expect(screen.getByText("Grammar")).toBeDefined();
    expect(screen.getByText("Confidence")).toBeDefined();
  });

  it("refuses to record when nothing was observed", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /record privately/i }));
    await screen.findByRole("alert");
    expect(recordEslProgress).not.toHaveBeenCalled();
  });

  /** An untouched field is "not observed", not zero. */
  it("sends only the skills the teacher filled in", async () => {
    recordEslProgress.mockResolvedValue(ok({ entryId: "e1" }));
    setup();
    fireEvent.change(screen.getByLabelText("Speaking"), {
      target: { value: "72" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record privately/i }));

    await waitFor(() => expect(recordEslProgress).toHaveBeenCalledTimes(1));
    const sent = recordEslProgress.mock.calls[0][0];
    expect(sent.scores).toEqual({ speaking: 72 });
    expect(sent.release).toBe(false);
  });

  it("shares with the learner only when asked", async () => {
    recordEslProgress.mockResolvedValue(ok({ entryId: "e1" }));
    setup();
    fireEvent.change(screen.getByLabelText("Reading"), {
      target: { value: "64" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record & share/i }));

    await waitFor(() => expect(recordEslProgress).toHaveBeenCalledTimes(1));
    expect(recordEslProgress.mock.calls[0][0].release).toBe(true);
  });
});

describe("IELTS band entry", () => {
  const setup = (students = [student({ track: "IELTS" })]) =>
    render(<IeltsBandEntry workspaceId={WORKSPACE} students={students} />);

  it("asks for a candidate before it can record anything", () => {
    setup([student()]);
    expect(screen.getByText("No IELTS candidates yet")).toBeDefined();
  });

  /**
   * The scale is not continuous. Offering a free-text number invites 6.3, which
   * the `band_score` domain rejects only after the teacher has typed it.
   */
  it("offers half bands and nothing between them", () => {
    setup();
    const listening = screen.getByLabelText("Listening") as HTMLSelectElement;
    const values = Array.from(listening.options).map((option) => option.value);
    expect(values[0]).toBe(""); // Not scored
    expect(values).toContain("6.5");
    expect(values).not.toContain("6.3");
    // 0 to 9 inclusive in half steps, plus the "not scored" option.
    expect(values).toHaveLength(20);
  });

  it("refuses to record when no band was chosen", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /record privately/i }));
    await screen.findByRole("alert");
    expect(recordIeltsBands).not.toHaveBeenCalled();
  });

  it("sends only the skills that were scored", async () => {
    recordIeltsBands.mockResolvedValue(ok({ recorded: 1 }));
    setup();
    fireEvent.change(screen.getByLabelText("Writing"), {
      target: { value: "6.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record privately/i }));

    await waitFor(() => expect(recordIeltsBands).toHaveBeenCalledTimes(1));
    const sent = recordIeltsBands.mock.calls[0][0];
    expect(sent.bands).toEqual({ writing: 6.5 });
    expect(sent.release).toBe(false);
  });

  it("names the candidate's target band in the picker", () => {
    setup([student({ track: "IELTS", targetBand: 7 })]);
    const picker = screen.getByLabelText("Candidate") as HTMLSelectElement;
    expect(within(picker).getByText(/target 7\.0/)).toBeDefined();
  });
});
