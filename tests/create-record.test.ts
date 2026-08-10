/**
 * The write path behind the quick actions.
 *
 * The behaviour worth pinning down is the honest failure: until a database is
 * connected, `createRecord` must refuse rather than report success. The old
 * drawer claimed "created successfully" for a write that never happened, and a
 * teacher would have lost the record without knowing.
 */

import { describe, expect, it } from "vitest";

import { createRecord, validateDraft } from "@/lib/actions/create-record";
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

describe("createRecord", () => {
  it("refuses an invalid draft without attempting a write", async () => {
    const result = await createRecord(draft({ title: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  it("refuses a valid draft, because nothing is connected yet", async () => {
    const result = await createRecord(draft());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not-connected");
      expect(result.message).toContain("Nothing has been stored");
    }
  });

  /**
   * Guards the regression that matters: if this ever starts returning ok:true
   * without a database behind it, the UI will silently discard a teacher's work
   * again.
   */
  it("never reports success while unconnected", async () => {
    for (const kind of ["student", "lesson", "homework", "assessment"] as const) {
      const result = await createRecord(draft({ kind }));
      expect(result.ok).toBe(false);
    }
  });
});
