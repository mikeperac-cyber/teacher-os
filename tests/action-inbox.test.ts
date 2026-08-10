/**
 * Action inbox ranking.
 *
 * The central claim is that the tiers are far enough apart that a genuine
 * blocker always outranks routine work — no matter how overdue the routine work
 * is. That is asserted directly below, because it is the property that makes
 * one merged queue better than three separate lists.
 */

import { describe, expect, it } from "vitest";

import { buildActionInbox, totalMinutes } from "@/lib/dashboard/action-inbox";
import { NOW, assessment, daysFromNow, homework, iso, task } from "./helpers";

const empty = { homework: [], assessments: [], tasks: [] };

describe("tier ordering", () => {
  it("ranks a lesson blocker above work that is a month overdue", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        homework: [
          homework({
            id: "blocker",
            task: "Blocks the next lesson",
            blocksLessonId: "l1",
            dueAt: iso(daysFromNow(1)),
          }),
          homework({
            id: "ancient",
            task: "Very overdue",
            dueAt: iso(daysFromNow(-30)),
          }),
        ],
      },
      "ESL",
      "l1",
      NOW,
    );

    expect(inbox[0].title).toBe("Blocks the next lesson");
    expect(inbox[0].blocksNextLesson).toBe(true);
  });

  it("ranks overdue above due-today", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        homework: [
          homework({ id: "today", task: "Due later today", dueAt: iso(daysFromNow(0, 18)) }),
          homework({ id: "late", task: "Overdue", dueAt: iso(daysFromNow(-1)) }),
        ],
      },
      "ESL",
      null,
      NOW,
    );

    expect(inbox.map((item) => item.title)).toEqual(["Overdue", "Due later today"]);
  });

  it("sorts more-overdue ahead of less-overdue", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        homework: [
          homework({ id: "a", task: "Two days late", dueAt: iso(daysFromNow(-2)) }),
          homework({ id: "b", task: "Ten days late", dueAt: iso(daysFromNow(-10)) }),
        ],
      },
      "ESL",
      null,
      NOW,
    );

    expect(inbox.map((item) => item.title)).toEqual([
      "Ten days late",
      "Two days late",
    ]);
  });

  it("marks a blocker only when it blocks the lesson actually next up", () => {
    const inbox = buildActionInbox(
      { ...empty, homework: [homework({ blocksLessonId: "some-other-lesson" })] },
      "ESL",
      "l1",
      NOW,
    );
    expect(inbox[0].blocksNextLesson).toBe(false);
  });
});

describe("what reaches the inbox", () => {
  it("admits tasks that are overdue or due today", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        tasks: [
          task({ id: "overdue", title: "Overdue task", dueAt: iso(daysFromNow(-1)) }),
          task({ id: "today", title: "Today task", dueAt: iso(daysFromNow(0, 17)) }),
        ],
      },
      "ESL",
      null,
      NOW,
    );
    expect(inbox).toHaveLength(2);
  });

  it("keeps future and undated tasks out, so the noise does not return", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        tasks: [
          task({ id: "future", title: "Next week", dueAt: iso(daysFromNow(7)) }),
          task({ id: "undated", title: "Someday", dueAt: null }),
        ],
      },
      "ESL",
      null,
      NOW,
    );
    expect(inbox).toEqual([]);
  });

  it("filters homework and assessments by track", () => {
    const inbox = buildActionInbox(
      {
        homework: [homework({ track: "ESL", task: "ESL work" })],
        assessments: [assessment({ track: "IELTS", title: "IELTS mock" })],
        tasks: [],
      },
      "IELTS",
      null,
      NOW,
    );
    expect(inbox.map((item) => item.title)).toEqual(["IELTS mock"]);
  });

  it("includes untracked tasks in both workspaces", () => {
    const shared = task({ track: null, dueAt: iso(daysFromNow(-1)) });
    for (const track of ["ESL", "IELTS"] as const) {
      const inbox = buildActionInbox({ ...empty, tasks: [shared] }, track, null, NOW);
      expect(inbox).toHaveLength(1);
    }
  });
});

describe("labelling", () => {
  it("describes how overdue an item is", () => {
    const inbox = buildActionInbox(
      { ...empty, homework: [homework({ dueAt: iso(daysFromNow(-2)) })] },
      "ESL",
      null,
      NOW,
    );
    expect(inbox[0].dueLabel).toBe("Overdue by 2 days");
    expect(inbox[0].overdue).toBe(true);
  });

  it("never invents a due date", () => {
    const inbox = buildActionInbox(
      { ...empty, homework: [homework({ dueAt: null })] },
      "ESL",
      null,
      NOW,
    );
    expect(inbox[0].dueLabel).toBe("No due date");
    expect(inbox[0].overdue).toBe(false);
  });
});

describe("totalMinutes", () => {
  it("sums estimates and tolerates missing ones", () => {
    const inbox = buildActionInbox(
      {
        ...empty,
        homework: [
          homework({ id: "a", minutes: 20, dueAt: iso(daysFromNow(-1)) }),
          homework({ id: "b", minutes: null, dueAt: iso(daysFromNow(-1)) }),
        ],
      },
      "ESL",
      null,
      NOW,
    );
    expect(totalMinutes(inbox)).toBe(20);
  });

  it("is zero for an empty inbox", () => {
    expect(totalMinutes([])).toBe(0);
  });
});
