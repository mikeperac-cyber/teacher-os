// @vitest-environment jsdom

/**
 * Replaces the retired `interactions-source.test.mjs`.
 *
 * That test scanned the text of `app/page.tsx` with a regular expression to
 * check every `<button>` carried an `onClick`. It could not tell whether a
 * handler did anything, and it broke as soon as components moved.
 *
 * This exercises the behaviour instead: the quick actions open a real form,
 * the form validates, and a valid submission surfaces the not-connected
 * failure rather than silently claiming success.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QuickActions } from "@/components/dashboard/QuickActions";

afterEach(cleanup);

describe("quick actions", () => {
  it("offers the four create actions", () => {
    render(<QuickActions track="ESL" />);
    expect(screen.getByText("Add learner")).toBeDefined();
    expect(screen.getByText("Plan lesson")).toBeDefined();
    expect(screen.getByText("Assign homework")).toBeDefined();
    expect(screen.getByText("Record check")).toBeDefined();
  });

  it("labels the actions for the IELTS workspace", () => {
    render(<QuickActions track="IELTS" />);
    expect(screen.getByText("Add candidate")).toBeDefined();
    expect(screen.getByText("Record mock")).toBeDefined();
  });

  it("opens a modal with track-specific fields", () => {
    render(<QuickActions track="IELTS" />);
    fireEvent.click(screen.getByText("Add candidate"));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("New IELTS candidate")).toBeDefined();
    expect(screen.getByText("Current band and target band")).toBeDefined();
  });

  it("reports field errors on an empty submit and does not close", async () => {
    render(<QuickActions track="ESL" />);
    fireEvent.click(screen.getByText("Add learner"));
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText("Give this a clear name.")).toBeDefined();
    });
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  /** The regression this whole feature exists to prevent. */
  it("states that nothing was stored instead of claiming success", async () => {
    render(<QuickActions track="ESL" />);
    fireEvent.click(screen.getByText("Add learner"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Sample Learner" } });
    fireEvent.change(inputs[1], { target: { value: "A2 to B1" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Nothing has been stored");
    // Still open — a closed modal would read as a successful save.
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("closes on cancel", () => {
    render(<QuickActions track="ESL" />);
    fireEvent.click(screen.getByText("Add learner"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
