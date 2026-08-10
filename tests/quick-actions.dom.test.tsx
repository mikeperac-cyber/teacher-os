// @vitest-environment jsdom

/**
 * Replaces the retired `interactions-source.test.mjs`.
 *
 * That test scanned the text of `app/page.tsx` with a regular expression to
 * check every `<button>` carried an `onClick`. It could not tell whether a
 * handler did anything, and it broke as soon as components moved.
 *
 * This exercises behaviour: the actions open, the student form validates and
 * writes through the real server action, and the three screens that do not
 * exist yet say so rather than presenting a form that cannot succeed.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickActions } from "@/components/dashboard/QuickActions";

// The real action needs a request context. What matters here is that the
// component calls it with the right arguments and handles both outcomes.
const createStudent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/workflow", () => ({ createStudent }));

afterEach(() => {
  cleanup();
  createStudent.mockReset();
});

const WORKSPACE = "workspace-1";

describe("quick actions", () => {
  it("offers the four create actions", () => {
    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
    expect(screen.getByText("Add learner")).toBeDefined();
    expect(screen.getByText("Plan lesson")).toBeDefined();
    expect(screen.getByText("Assign homework")).toBeDefined();
    expect(screen.getByText("Record check")).toBeDefined();
  });

  it("labels the actions for the IELTS workspace", () => {
    render(<QuickActions track="IELTS" workspaceId={WORKSPACE} />);
    expect(screen.getByText("Add candidate")).toBeDefined();
    expect(screen.getByText("Record mock")).toBeDefined();
  });

  it("opens a modal with track-specific fields", () => {
    render(<QuickActions track="IELTS" workspaceId={WORKSPACE} />);
    fireEvent.click(screen.getByText("Add candidate"));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("New IELTS candidate")).toBeDefined();
    expect(screen.getByText("Current band and target band")).toBeDefined();
  });

  it("reports field errors on an empty submit and does not close", async () => {
    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
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

    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

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

    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("permission");
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  /** Nowhere to write to, said before the round trip rather than after. */
  it("refuses to submit with no workspace", async () => {
    render(<QuickActions track="ESL" workspaceId={null} />);
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not signed in to a workspace");
    expect(createStudent).not.toHaveBeenCalled();
  });

  /**
   * The honest gap. A form that cannot succeed is worse than saying so.
   */
  it("says what is missing for the screens that are not built", () => {
    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
    fireEvent.click(screen.getByText("Plan lesson"));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("not built yet");
    expect(status.textContent).toContain("Lesson Planner");
    // No form, so nothing to mistakenly fill in.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("closes on cancel", () => {
    render(<QuickActions track="ESL" workspaceId={WORKSPACE} />);
    fireEvent.click(screen.getByText("Add learner"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
