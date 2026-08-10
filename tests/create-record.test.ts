/**
 * The write path behind the quick actions.
 *
 * These rules run on the client for instant feedback and are enforced again by
 * `createStudent` and by database constraints. They are a convenience, never a
 * control.
 */

import { describe, expect, it } from "vitest";

import { validateDraft } from "@/lib/actions/create-record";
import type { RecordDraft } from "@/lib/actions/create-record";

const draft = (over: Partial<RecordDraft> = {}): RecordDraft => ({
  kind: "student",
  track: "ESL",
  title: "Sample Learner",
  subject: "A2 → B1",
  ...over,
});

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it("requires a title", () => {
    expect(validateDraft(draft({ title: "   " })).title).toBeDefined();
  });

  it("rejects a title too short to identify later", () => {
    expect(validateDraft(draft({ title: "a" })).title).toBeDefined();
  });

  it("requires the second field", () => {
    expect(validateDraft(draft({ subject: "" })).subject).toBeDefined();
  });

  it("names the track-specific field in the error", () => {
    const esl = validateDraft(draft({ track: "ESL", subject: "" })).subject;
    const ielts = validateDraft(draft({ track: "IELTS", subject: "" })).subject;
    expect(esl).toContain("cefr level and learning goal");
    expect(ielts).toContain("current band and target band");
  });
});
