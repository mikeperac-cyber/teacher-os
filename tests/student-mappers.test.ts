/**
 * The learner-facing mapping layer.
 *
 * Same reasoning as `mappers.test.ts`: this is where a mistake is silent. A
 * wrong state here does not throw, it just tells a learner their work came back
 * when it did not — or worse, shows them a comment the teacher had not finished
 * writing.
 */

import { describe, expect, it } from "vitest";

import {
  mapEslEntry,
  mapIeltsScore,
  mapStudentHomework,
  sortHomework,
  stateOf,
  type StudentAssignmentRow,
} from "@/lib/queries/student-mappers";
import type { StudentHomework } from "@/lib/types/student";

const assignmentRow = (
  submissions: unknown,
): StudentAssignmentRow => ({
  id: "a1",
  title: "Unit 6",
  instructions: "Do the exercises",
  track: "esl",
  due_at: "2026-08-12T17:00:00.000Z",
  estimated_minutes: 20,
  homework_submissions: submissions,
});

describe("stateOf", () => {
  it("is todo before the learner starts", () => {
    expect(stateOf(null, null)).toBe("todo");
  });

  it("is draft while the learner is still writing", () => {
    expect(stateOf({ id: "s", status: "draft", body: "…" }, null)).toBe("draft");
  });

  it("is submitted once it is with the teacher", () => {
    expect(stateOf({ id: "s", status: "submitted", body: "x" }, null)).toBe(
      "submitted",
    );
  });

  /**
   * The claim that matters. A teacher can write feedback, not release it, and
   * the submission row can already say 'returned'. From the learner's side
   * nothing has come back, and the portal must say so.
   */
  it("is not returned while the feedback is still held back", () => {
    expect(
      stateOf(
        { id: "s", status: "returned", body: "x" },
        { body: "half written", released_at: null },
      ),
    ).toBe("submitted");
  });

  it("is returned once the feedback is released", () => {
    expect(
      stateOf(
        { id: "s", status: "returned", body: "x" },
        { body: "well done", released_at: "2026-08-11T09:00:00.000Z" },
      ),
    ).toBe("returned");
  });
});

describe("mapStudentHomework", () => {
  it("reads the submission through either embed shape", () => {
    const asObject = mapStudentHomework(
      assignmentRow({ id: "s1", status: "submitted", body: "mine" }),
    );
    const asArray = mapStudentHomework(
      assignmentRow([{ id: "s1", status: "submitted", body: "mine" }]),
    );
    for (const mapped of [asObject, asArray]) {
      expect(mapped.submissionId).toBe("s1");
      expect(mapped.body).toBe("mine");
      expect(mapped.state).toBe("submitted");
    }
  });

  it("carries no feedback at all when it has not been released", () => {
    const mapped = mapStudentHomework(
      assignmentRow({
        id: "s1",
        status: "returned",
        body: "mine",
        homework_feedback: { body: "not ready", released_at: null },
      }),
    );
    expect(mapped.feedback).toBeNull();
    expect(mapped.feedbackReleasedAt).toBeNull();
  });

  it("carries the feedback once released", () => {
    const mapped = mapStudentHomework(
      assignmentRow({
        id: "s1",
        status: "returned",
        body: "mine",
        homework_feedback: {
          body: "Good use of past simple",
          released_at: "2026-08-11T09:00:00.000Z",
        },
      }),
    );
    expect(mapped.feedback).toBe("Good use of past simple");
    expect(mapped.state).toBe("returned");
  });

  it("treats an assignment with no submission as work to do", () => {
    const mapped = mapStudentHomework(assignmentRow(null));
    expect(mapped.state).toBe("todo");
    expect(mapped.submissionId).toBeNull();
    expect(mapped.body).toBe("");
  });
});

describe("sortHomework", () => {
  const item = (over: Partial<StudentHomework>): StudentHomework => ({
    assignmentId: "a",
    submissionId: null,
    title: "t",
    instructions: null,
    track: "ESL",
    dueAt: null,
    estimatedMinutes: null,
    state: "todo",
    body: "",
    feedback: null,
    feedbackReleasedAt: null,
    ...over,
  });

  it("puts what the learner still owes above what is finished", () => {
    const sorted = sortHomework([
      item({ assignmentId: "done", state: "returned" }),
      item({ assignmentId: "sent", state: "submitted" }),
      item({ assignmentId: "todo", state: "todo" }),
    ]);
    expect(sorted.map((i) => i.assignmentId)).toEqual(["todo", "sent", "done"]);
  });

  it("orders equal states by due date, soonest first", () => {
    const sorted = sortHomework([
      item({ assignmentId: "later", dueAt: "2026-08-20T00:00:00.000Z" }),
      item({ assignmentId: "sooner", dueAt: "2026-08-12T00:00:00.000Z" }),
    ]);
    expect(sorted.map((i) => i.assignmentId)).toEqual(["sooner", "later"]);
  });

  it("puts undated work after dated work", () => {
    const sorted = sortHomework([
      item({ assignmentId: "undated", dueAt: null }),
      item({ assignmentId: "dated", dueAt: "2026-08-12T00:00:00.000Z" }),
    ]);
    expect(sorted.map((i) => i.assignmentId)).toEqual(["dated", "undated"]);
  });
});

describe("mapEslEntry", () => {
  /** A skill that was not observed must not become a score of zero. */
  it("omits skills that were not recorded", () => {
    const mapped = mapEslEntry({
      id: "e1",
      recorded_at: "2026-08-11T09:00:00.000Z",
      speaking: 72,
      grammar: null,
      note: null,
    });
    expect(mapped.scores).toEqual({ speaking: 72 });
    expect("grammar" in mapped.scores).toBe(false);
  });

  it("keeps a genuine zero", () => {
    const mapped = mapEslEntry({
      id: "e1",
      recorded_at: "2026-08-11T09:00:00.000Z",
      reading: 0,
      note: null,
    });
    expect(mapped.scores.reading).toBe(0);
  });
});

describe("mapIeltsScore", () => {
  /**
   * numeric(2,1) comes back from PostgREST as a string, and `"6.5" < 7` is a
   * string comparison — the kind of bug that sorts 10 before 9.
   */
  it("coerces the band to a number", () => {
    const mapped = mapIeltsScore({
      id: "s1",
      recorded_at: "2026-08-11T09:00:00.000Z",
      skill: "writing",
      band: "6.5",
    });
    expect(mapped.band).toBe(6.5);
    expect(typeof mapped.band).toBe("number");
    expect(mapped.skill).toBe("Writing");
  });
});
