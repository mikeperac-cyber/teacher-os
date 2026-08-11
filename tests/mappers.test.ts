/**
 * Row-to-domain mapping.
 *
 * These exist because of a bug this layer had and nothing would have caught.
 *
 * PostgREST returns an embedded resource as an array normally, but as a single
 * object when a unique constraint proves the relationship is one-to-one. Three
 * of ours qualify: lesson_plans, homework_feedback and ielts_student_profiles.
 * The original code indexed `[0]` into all of them, which yields `undefined`
 * against an object — no error, just a lesson with no plan, a candidate with no
 * target band, and an action inbox that silently discarded every item.
 *
 * Every mapper below is therefore tested against both shapes. If a constraint
 * changes and PostgREST switches representation, nothing breaks.
 */

import { describe, expect, it } from "vitest";

import {
  firstOf,
  isEmptyEmbed,
  mapCapacity,
  mapGoalReview,
  mapLesson,
  mapStudentSignal,
  mapSubmission,
  mapTask,
  needsTeacher,
} from "@/lib/queries/mappers";

describe("firstOf", () => {
  it("unwraps an array", () => {
    expect(firstOf<{ a: number }>([{ a: 1 }, { a: 2 }])).toEqual({ a: 1 });
  });

  it("passes a bare object through", () => {
    expect(firstOf<{ a: number }>({ a: 1 })).toEqual({ a: 1 });
  });

  it("returns null for an empty array, null and undefined", () => {
    expect(firstOf([])).toBeNull();
    expect(firstOf(null)).toBeNull();
    expect(firstOf(undefined)).toBeNull();
  });
});

describe("isEmptyEmbed", () => {
  it("treats an object as present", () => {
    expect(isEmptyEmbed({ id: "x" })).toBe(false);
  });

  it("treats an empty array, null and undefined as absent", () => {
    expect(isEmptyEmbed([])).toBe(true);
    expect(isEmptyEmbed(null)).toBe(true);
    expect(isEmptyEmbed(undefined)).toBe(true);
  });
});

const lessonRow = (plans: unknown) => ({
  id: "l1",
  student_id: "s1",
  track: "ielts" as const,
  starts_at: "2026-08-11T19:00:00.000Z",
  ends_at: "2026-08-11T20:00:00.000Z",
  students: { full_name: "Ada Lovelace" },
  lesson_plans: plans,
});

describe("mapLesson", () => {
  it("finds the plan when PostgREST returns an object", () => {
    const lesson = mapLesson(
      lessonRow({ objective: "Band 7 task response", blocks: [{}, {}] }),
    );
    expect(lesson.hasPlan).toBe(true);
    expect(lesson.objective).toBe("Band 7 task response");
    expect(lesson.plannedBlocks).toBe(2);
  });

  it("finds the plan when PostgREST returns an array", () => {
    const lesson = mapLesson(
      lessonRow([{ objective: "Band 7 task response", blocks: [{}, {}] }]),
    );
    expect(lesson.hasPlan).toBe(true);
    expect(lesson.objective).toBe("Band 7 task response");
  });

  it("reports no plan when there is none", () => {
    expect(mapLesson(lessonRow(null)).hasPlan).toBe(false);
    expect(mapLesson(lessonRow([])).hasPlan).toBe(false);
  });

  it("derives initials and a track label", () => {
    const lesson = mapLesson(lessonRow(null));
    expect(lesson.studentInitials).toBe("AL");
    expect(lesson.track).toBe("IELTS");
    expect(lesson.courseLabel).toBe("IELTS Academic");
  });

  it("survives a missing student embed rather than throwing", () => {
    const lesson = mapLesson({ ...lessonRow(null), students: null });
    expect(lesson.studentName).toBe("Unknown learner");
  });
});

const submissionRow = (feedback: unknown) => ({
  id: "sub1",
  student_id: "s1",
  status: "submitted",
  students: { full_name: "Ada Lovelace" },
  homework_assignments: {
    title: "Timed Task 2",
    track: "ielts" as const,
    due_at: "2026-08-11T17:00:00.000Z",
    estimated_minutes: 40,
    blocks_lesson_id: "l1",
  },
  homework_feedback: feedback,
});

describe("needsTeacher", () => {
  /**
   * The regression that mattered most: this decides whether an item reaches
   * the action inbox at all.
   */
  it("counts a submission with no feedback", () => {
    expect(needsTeacher(submissionRow(null))).toBe(true);
    expect(needsTeacher(submissionRow([]))).toBe(true);
  });

  it("still counts feedback that has been written but not released", () => {
    expect(needsTeacher(submissionRow({ released_at: null }))).toBe(true);
    expect(needsTeacher(submissionRow([{ released_at: null }]))).toBe(true);
  });

  it("drops a submission whose feedback is released, in either shape", () => {
    const released = "2026-08-10T09:00:00.000Z";
    expect(needsTeacher(submissionRow({ released_at: released }))).toBe(false);
    expect(needsTeacher(submissionRow([{ released_at: released }]))).toBe(false);
  });
});

describe("mapSubmission", () => {
  it("reads the assignment through either embed shape", () => {
    const fromObject = mapSubmission(submissionRow(null));
    const fromArray = mapSubmission({
      ...submissionRow(null),
      homework_assignments: [submissionRow(null).homework_assignments],
    });

    for (const mapped of [fromObject, fromArray]) {
      expect(mapped.task).toBe("Timed Task 2");
      expect(mapped.track).toBe("IELTS");
      expect(mapped.minutes).toBe(40);
      expect(mapped.blocksLessonId).toBe("l1");
    }
  });

  it("falls back sanely when the assignment embed is missing", () => {
    const mapped = mapSubmission({
      ...submissionRow(null),
      homework_assignments: null,
    });
    expect(mapped.task).toBe("Homework");
    expect(mapped.dueAt).toBeNull();
  });
});

describe("mapStudentSignal", () => {
  const base = {
    id: "s1",
    full_name: "Ada Lovelace",
    track: "ielts" as const,
  };

  it("reads the IELTS profile from an object embed", () => {
    const signal = mapStudentSignal({
      ...base,
      ielts_student_profiles: { target_band: 7, test_date: "2026-10-12" },
    });
    expect(signal.targetBand).toBe(7);
    expect(signal.testDate).toBe("2026-10-12");
  });

  it("reads it from an array embed too", () => {
    const signal = mapStudentSignal({
      ...base,
      ielts_student_profiles: [{ target_band: 7, test_date: "2026-10-12" }],
    });
    expect(signal.targetBand).toBe(7);
  });

  /**
   * `undefined`, not null: the at-risk rules check `targetBand !== undefined`
   * to decide whether a target is known at all.
   */
  it("leaves targetBand undefined when there is no profile", () => {
    const signal = mapStudentSignal({ ...base, ielts_student_profiles: null });
    expect(signal.targetBand).toBeUndefined();
    expect(signal.testDate).toBeNull();
  });

  it("defaults unknown engagement to no evidence rather than good news", () => {
    const signal = mapStudentSignal(base);
    expect(signal.lastActiveAt).toBeNull();
    expect(signal.missedHomework).toBe(0);
  });
});

describe("mapTask", () => {
  it("maps the database's lowercase priority to the display form", () => {
    const row = {
      id: "t1",
      title: "Mark scripts",
      detail: null,
      priority: "high",
      due_at: null,
      estimated_minutes: null,
      track: null,
    };
    const mapped = mapTask(row);
    expect(mapped.priority).toBe("High");
    expect(mapped.detail).toBe("");
    expect(mapped.track).toBeNull();
  });

  it("falls back to Medium for an unrecognised priority", () => {
    const mapped = mapTask({
      id: "t1",
      title: "x",
      detail: null,
      priority: "urgent-ish",
      due_at: null,
      estimated_minutes: null,
      track: "esl",
    });
    expect(mapped.priority).toBe("Medium");
    expect(mapped.track).toBe("ESL");
  });
});

describe("mapGoalReview and mapCapacity", () => {
  it("maps a goal with either student embed shape", () => {
    const row = {
      id: "g1",
      title: "Speak for two minutes unprompted",
      progress: 40,
      review_due_at: "2026-08-14",
      track: "esl" as const,
      students: { full_name: "Ada Lovelace" },
    };
    expect(mapGoalReview(row).studentName).toBe("Ada Lovelace");
    expect(
      mapGoalReview({ ...row, students: [{ full_name: "Ada Lovelace" }] })
        .studentInitials,
    ).toBe("AL");
  });

  it("treats a null progress as zero", () => {
    const mapped = mapGoalReview({
      id: "g1",
      title: "x",
      progress: null,
      review_due_at: "2026-08-14",
      track: null,
      students: null,
    });
    expect(mapped.progress).toBe(0);
  });

  /** The capacity strip keys days by this exact string. */
  it("passes the date through unchanged", () => {
    expect(mapCapacity({ day: "2026-08-10", capacity: 3 })).toEqual({
      date: "2026-08-10",
      capacity: 3,
    });
  });
});
