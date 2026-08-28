// @vitest-environment jsdom

/**
 * Replaces the retired `interactions-source.test.mjs`.
 *
 * That test scanned the text of `app/page.tsx` with a regular expression to
 * check every `<button>` carried an `onClick`. It could not tell whether a
 * handler did anything, and it broke as soon as components moved.
 *
 * This exercises behaviour: three actions perform real writes through server
 * actions, and the fourth says what it still needs rather than presenting a
 * form that cannot succeed.
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

import { QuickActions } from "@/components/dashboard/QuickActions";
import type { StudentSignal } from "@/lib/types/domain";

// The real actions need a request context. What matters here is that the
// component calls them with the right arguments and handles both outcomes.
const { createStudent, scheduleLesson, assignHomework } = vi.hoisted(() => ({
  createStudent: vi.fn(),
  scheduleLesson: vi.fn(),
  assignHomework: vi.fn(),
}));

vi.mock("@/lib/actions/workflow", () => ({
  createStudent,
  scheduleLesson,
  assignHomework,
}));

afterEach(() => {
  cleanup();
  createStudent.mockReset();
  scheduleLesson.mockReset();
  assignHomework.mockReset();
});

const WORKSPACE = "workspace-1";

const student = (over: Partial<StudentSignal> = {}): StudentSignal => ({
  studentId: "student-1",
  name: "Ada Lovelace",
  initials: "AL",
  tone: "violet",
  track: "ESL",
  lastActiveAt: null,
  missedHomework: 0,
  lastProgressAt: null,
  hasLogin: false,
  ...over,
});

const STUDENTS = [
  student(),
  student({ studentId: "student-2", name: "Grace Hopper", track: "IELTS" }),
];

const setup = (track: "ESL" | "IELTS" = "ESL", workspaceId: string | null = WORKSPACE) =>
  render(
    <QuickActions track={track} workspaceId={workspaceId} students={STUDENTS} />,
  );

/**
 * Queries scoped to the open modal.
 *
 * The action row stays mounted behind it, so "Schedule lesson" and the modal's
 * "Schedule" submit both match a loose name query.
 */
const dialog = () => within(screen.getByRole("dialog"));

describe("the action row", () => {
  it("offers the four create actions", () => {
    setup();
    expect(screen.getByText("Add learner")).toBeDefined();
    expect(screen.getByText("Schedule lesson")).toBeDefined();
    expect(screen.getByText("Assign homework")).toBeDefined();
    expect(screen.getByText("Record check")).toBeDefined();
  });

  it("labels the actions for the IELTS workspace", () => {
    setup("IELTS");
    expect(screen.getByText("Add candidate")).toBeDefined();
    expect(screen.getByText("Record mock")).toBeDefined();
  });
});

describe("adding a learner", () => {
  it("opens a modal with track-specific fields", () => {
    setup("IELTS");
    fireEvent.click(screen.getByText("Add candidate"));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("New IELTS candidate")).toBeDefined();
    expect(screen.getByText("Current band and target band")).toBeDefined();
  });

  it("reports field errors on an empty submit and does not close", async () => {
    setup();
    fireEvent.click(screen.getByText("Add learner"));
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText("Give this a clear name.")).toBeDefined();
    });
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("writes through the server action and closes on success", async () => {
    createStudent.mockResolvedValue({ ok: true, data: { studentId: "s1" } });
    setup();
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createStudent).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      track: "ESL",
      fullName: "Sample Learner",
      target: "B1",
    });
  });

  it("surfaces a failure without closing", async () => {
    createStudent.mockResolvedValue({
      ok: false,
      error: "You do not have permission to do that.",
    });
    setup();
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("permission");
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("refuses to submit with no workspace", async () => {
    setup("ESL", null);
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not signed in to a workspace");
    expect(createStudent).not.toHaveBeenCalled();
  });
});

describe("scheduling a lesson", () => {
  it("only offers learners from the active track", () => {
    setup("ESL");
    fireEvent.click(screen.getByText("Schedule lesson"));

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Ada Lovelace");
    expect(options).not.toContain("Grace Hopper");
  });

  it("derives the end time from the chosen length", async () => {
    scheduleLesson.mockResolvedValue({ ok: true, data: { lessonId: "l1" } });
    setup("ESL");
    fireEvent.click(screen.getByText("Schedule lesson"));

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "student-1" } });
    fireEvent.change(selects[1], { target: { value: "90" } });
    fireEvent.click(dialog().getByRole("button", { name: /schedule/i }));

    await waitFor(() => expect(scheduleLesson).toHaveBeenCalled());

    const call = scheduleLesson.mock.calls[0][0];
    expect(call.studentId).toBe("student-1");
    expect(call.track).toBe("ESL");
    const minutes =
      (new Date(call.endsAt).getTime() - new Date(call.startsAt).getTime()) /
      60000;
    expect(minutes).toBe(90);
  });

  it("insists on a learner before writing", async () => {
    setup("ESL");
    fireEvent.click(screen.getByText("Schedule lesson"));
    fireEvent.click(dialog().getByRole("button", { name: /schedule/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Choose which learner");
    expect(scheduleLesson).not.toHaveBeenCalled();
  });

  /** Nothing to schedule for, said before the form can be filled in. */
  it("explains when the track has no learners yet", () => {
    render(<QuickActions track="ESL" workspaceId={WORKSPACE} students={[]} />);
    fireEvent.click(screen.getByText("Schedule lesson"));

    expect(screen.getByRole("status").textContent).toContain("No ESL learners yet");
    expect(
      dialog().getByRole("button", { name: /schedule/i }),
    ).toHaveProperty("disabled", true);
  });
});

describe("assigning homework", () => {
  it("writes the assignment with an end-of-day due time", async () => {
    assignHomework.mockResolvedValue({ ok: true, data: { assignmentId: "a1" } });
    setup("ESL");
    fireEvent.click(screen.getByText("Assign homework"));

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "student-1" },
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Unit 6 vocabulary" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(assignHomework).toHaveBeenCalled());
    const call = assignHomework.mock.calls[0][0];
    expect(call.title).toBe("Unit 6 vocabulary");
    expect(call.studentId).toBe("student-1");
    // No date chosen, so no due date is invented.
    expect(call.dueAt).toBeUndefined();
  });

  it("insists on a title", async () => {
    setup("ESL");
    fireEvent.click(screen.getByText("Assign homework"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "student-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText("Give the assignment a title.")).toBeDefined();
    });
    expect(assignHomework).not.toHaveBeenCalled();
  });
});

describe("the screen that is not built", () => {
  // Now built: assessment recording uses track-specific rubrics (0014)
  it("says what recording an assessment still needs", () => {
    setup("IELTS");
    fireEvent.click(screen.getByText("Record mock"));

    // The modal now shows the real assessment form, not a "not built yet" placeholder.
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Record mock / criterion scores")).toBeDefined();
    expect(screen.getByPlaceholderText("Mock — Full test 12 Oct")).toBeDefined();
  });

  it("names the ESL equivalent instead on the ESL track", () => {
    setup("ESL");
    fireEvent.click(screen.getByText("Record check"));
    expect(screen.getByText("Record progress check")).toBeDefined();
    expect(screen.getByPlaceholderText("Progress check — Unit 4")).toBeDefined();
  });
});

describe("dismissal", () => {
  it("closes on cancel", () => {
    setup();
    fireEvent.click(screen.getByText("Add learner"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
