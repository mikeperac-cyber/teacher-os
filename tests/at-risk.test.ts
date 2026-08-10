/**
 * Triage rules for at-risk learners.
 *
 * These thresholds are pedagogical judgements, so the tests state them in the
 * teacher's language rather than restating the implementation.
 */

import { describe, expect, it } from "vitest";

import {
  INACTIVE_DAYS,
  MISSED_HOMEWORK_HIGH,
  buildAtRiskStudents,
  flagsFor,
} from "@/lib/dashboard/at-risk";
import { NOW, daysFromNow, iso, signal } from "./helpers";

const reasons = (s: Parameters<typeof flagsFor>[0]) =>
  flagsFor(s, NOW).map((flag) => flag.reason);

describe("inactivity", () => {
  it("does not flag a learner seen yesterday", () => {
    const s = signal({ lastActiveAt: iso(daysFromNow(-1)) });
    expect(reasons(s)).not.toContain("inactive");
  });

  it("flags a learner inactive for the threshold", () => {
    const s = signal({ lastActiveAt: iso(daysFromNow(-INACTIVE_DAYS)) });
    expect(reasons(s)).toContain("inactive");
  });

  it("escalates to high at double the threshold", () => {
    const s = signal({ lastActiveAt: iso(daysFromNow(-INACTIVE_DAYS * 2)) });
    const flag = flagsFor(s, NOW).find((f) => f.reason === "inactive");
    expect(flag?.severity).toBe("high");
  });

  it("flags a learner who has never been active", () => {
    expect(reasons(signal({ lastActiveAt: null }))).toContain("inactive");
  });
});

describe("missed homework", () => {
  it("ignores a learner with none missed", () => {
    expect(reasons(signal({ missedHomework: 0 }))).not.toContain("missed-homework");
  });

  it("watches a learner with one missed", () => {
    const flag = flagsFor(signal({ missedHomework: 1 }), NOW).find(
      (f) => f.reason === "missed-homework",
    );
    expect(flag?.severity).toBe("watch");
  });

  it("escalates at the high threshold", () => {
    const flag = flagsFor(
      signal({ missedHomework: MISSED_HOMEWORK_HIGH }),
      NOW,
    ).find((f) => f.reason === "missed-homework");
    expect(flag?.severity).toBe("high");
  });

  it("pluralises the detail correctly", () => {
    const one = flagsFor(signal({ missedHomework: 1 }), NOW)[0];
    const two = flagsFor(signal({ missedHomework: 2 }), NOW)[0];
    expect(one.detail).toBe("1 assignment missed");
    expect(two.detail).toBe("2 assignments missed");
  });
});

/**
 * The rule that must not be "simplified" — CLAUDE.md rule 5.
 * CEFR mastery and IELTS bands are different measurements on different scales.
 */
describe("track separation", () => {
  it("never applies band rules to an ESL learner", () => {
    const s = signal({
      track: "ESL",
      bandHistory: [6, 6],
      targetBand: 7,
      testDate: iso(daysFromNow(10)),
      masteryHistory: undefined,
    });
    expect(reasons(s)).not.toContain("stalled-band");
    expect(reasons(s)).not.toContain("test-approaching");
  });

  it("never applies mastery rules to an IELTS candidate", () => {
    const s = signal({
      track: "IELTS",
      masteryHistory: [70, 70],
      lastProgressAt: iso(daysFromNow(-60)),
    });
    expect(reasons(s)).not.toContain("stalled-mastery");
  });
});

describe("ESL stalled mastery", () => {
  it("ignores mastery that is still moving", () => {
    const s = signal({
      masteryHistory: [70, 78],
      lastProgressAt: iso(daysFromNow(-60)),
    });
    expect(reasons(s)).not.toContain("stalled-mastery");
  });

  it("ignores flat mastery that was only just recorded", () => {
    const s = signal({
      masteryHistory: [70, 70],
      lastProgressAt: iso(daysFromNow(-2)),
    });
    expect(reasons(s)).not.toContain("stalled-mastery");
  });

  it("flags mastery flat for long enough", () => {
    const s = signal({
      masteryHistory: [70, 70],
      lastProgressAt: iso(daysFromNow(-30)),
    });
    expect(reasons(s)).toContain("stalled-mastery");
  });
});

describe("IELTS stalled band", () => {
  const ielts = (over = {}) =>
    signal({ track: "IELTS", targetBand: 7, ...over });

  it("ignores a band that is rising", () => {
    const s = ielts({ bandHistory: [6, 6.5] });
    expect(reasons(s)).not.toContain("stalled-band");
  });

  it("ignores a candidate already at target", () => {
    const s = ielts({ bandHistory: [7, 7] });
    expect(reasons(s)).not.toContain("stalled-band");
  });

  it("flags a flat band below target", () => {
    const s = ielts({ bandHistory: [6, 6] });
    expect(reasons(s)).toContain("stalled-band");
  });

  it("escalates when the test is close", () => {
    const s = ielts({ bandHistory: [6, 6], testDate: iso(daysFromNow(14)) });
    const flag = flagsFor(s, NOW).find((f) => f.reason === "stalled-band");
    expect(flag?.severity).toBe("high");
    expect(flag?.detail).toContain("test in 14 days");
  });

  it("does not escalate for a distant test", () => {
    const s = ielts({ bandHistory: [6, 6], testDate: iso(daysFromNow(120)) });
    const flag = flagsFor(s, NOW).find((f) => f.reason === "stalled-band");
    expect(flag?.severity).toBe("watch");
  });

  it("ignores a test date that has already passed", () => {
    const s = ielts({ bandHistory: [6, 6], testDate: iso(daysFromNow(-5)) });
    expect(reasons(s)).not.toContain("test-approaching");
  });
});

describe("ranking", () => {
  it("puts high severity before watch, and more flags before fewer", () => {
    const students = buildAtRiskStudents(
      [
        signal({ studentId: "watch", name: "Watch One", missedHomework: 1 }),
        signal({
          studentId: "high",
          name: "High One",
          missedHomework: 5,
        }),
        signal({
          studentId: "highTwo",
          name: "High Two",
          missedHomework: 5,
          lastActiveAt: iso(daysFromNow(-40)),
        }),
      ],
      "ESL",
      NOW,
    );

    expect(students.map((s) => s.studentId)).toEqual(["highTwo", "high", "watch"]);
  });

  it("omits learners with no flags at all", () => {
    const students = buildAtRiskStudents([signal()], "ESL", NOW);
    expect(students).toEqual([]);
  });

  it("only returns learners from the requested track", () => {
    const students = buildAtRiskStudents(
      [
        signal({ studentId: "esl", track: "ESL", missedHomework: 4 }),
        signal({ studentId: "ielts", track: "IELTS", missedHomework: 4 }),
      ],
      "IELTS",
      NOW,
    );
    expect(students.map((s) => s.studentId)).toEqual(["ielts"]);
  });
});
