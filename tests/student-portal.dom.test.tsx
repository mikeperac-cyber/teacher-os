// @vitest-environment jsdom

/**
 * The learner's portal, and the owner panel that grants access to it.
 *
 * The portal is the only screen a non-staff person ever sees, so the assertions
 * here are mostly about what is *absent*: no other learner, no unreleased
 * feedback, no editable box on work already sent. Postgres enforces all three,
 * but a component that renders a field it should not have received would still
 * be a leak the day a policy changes.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentPortal } from "@/components/student/StudentPortal";
import { LearnerAccess } from "@/components/students/LearnerAccess";
import type { StudentSignal } from "@/lib/types/domain";
import type { StudentHomework, StudentSnapshot } from "@/lib/types/student";

const { submitHomework, linkStudentAccount, unlinkStudentAccount } = vi.hoisted(
  () => ({
    submitHomework: vi.fn(),
    linkStudentAccount: vi.fn(),
    unlinkStudentAccount: vi.fn(),
  }),
);

vi.mock("@/lib/actions/workflow", () => ({
  submitHomework,
  linkStudentAccount,
  unlinkStudentAccount,
}));
vi.mock("@/lib/auth/actions", () => ({ signOutAction: vi.fn() }));

afterEach(() => {
  cleanup();
  submitHomework.mockReset();
  linkStudentAccount.mockReset();
  unlinkStudentAccount.mockReset();
});

const NOW = new Date(2026, 7, 10, 9, 0, 0);
const ok = (data: unknown = {}) => ({ ok: true, data });

const homework = (over: Partial<StudentHomework> = {}): StudentHomework => ({
  assignmentId: "a1",
  submissionId: null,
  title: "Unit 6 vocabulary",
  instructions: "Complete both exercises.",
  track: "ESL",
  dueAt: new Date(2026, 7, 11, 17, 0).toISOString(),
  estimatedMinutes: 20,
  state: "todo",
  body: "",
  feedback: null,
  feedbackReleasedAt: null,
  ...over,
});

const snapshot = (over: Partial<StudentSnapshot> = {}): StudentSnapshot => ({
  learner: {
    studentId: "student-1",
    workspaceId: "workspace-1",
    fullName: "Ada Lovelace",
    track: "ESL",
  },
  lessons: [
    {
      id: "l1",
      startsAt: new Date(2026, 7, 12, 19, 0).toISOString(),
      endsAt: new Date(2026, 7, 12, 20, 0).toISOString(),
      track: "ESL",
      sharedNote: null,
    },
  ],
  homework: [homework()],
  progress: { track: "ESL", entries: [] },
  ...over,
});

const setup = (data: StudentSnapshot = snapshot()) =>
  render(
    <StudentPortal
      snapshot={data}
      displayName="Ada Lovelace"
      nowIso={NOW.toISOString()}
    />,
  );

describe("a learner who is not linked yet", () => {
  it("is told why the screen is empty rather than shown an empty screen", () => {
    setup(snapshot({ learner: null }));
    expect(
      screen.getByText(/has not connected your account/i),
    ).toBeDefined();
  });
});

describe("homework the learner still owes", () => {
  it("offers somewhere to write", () => {
    setup();
    expect(screen.getByText("To do")).toBeDefined();
    expect(screen.getByPlaceholderText("Write your answer here")).toBeDefined();
  });

  it("refuses to send an empty answer", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /send to teacher/i }));
    await screen.findByRole("alert");
    expect(submitHomework).not.toHaveBeenCalled();
  });

  /** Saving a draft and sending are different acts, as they are for the teacher. */
  it("saves a draft without sending it", async () => {
    submitHomework.mockResolvedValue(ok({ submissionId: "s1" }));
    setup();
    fireEvent.change(screen.getByPlaceholderText("Write your answer here"), {
      target: { value: "half an answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(submitHomework).toHaveBeenCalledTimes(1));
    const sent = submitHomework.mock.calls[0][0];
    expect(sent.submit).toBe(false);
    expect(sent.assignmentId).toBe("a1");
    expect(sent.studentId).toBe("student-1");
    expect(sent.workspaceId).toBe("workspace-1");

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/cannot see it yet/i);
  });

  it("sends when the learner chooses to", async () => {
    submitHomework.mockResolvedValue(ok({ submissionId: "s1" }));
    setup();
    fireEvent.change(screen.getByPlaceholderText("Write your answer here"), {
      target: { value: "my finished answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send to teacher/i }));

    await waitFor(() => expect(submitHomework).toHaveBeenCalledTimes(1));
    expect(submitHomework.mock.calls[0][0].submit).toBe(true);
  });

  it("reports a refusal from the database rather than claiming success", async () => {
    submitHomework.mockResolvedValue({
      ok: false,
      error: "You do not have permission to do that.",
    });
    setup();
    fireEvent.change(screen.getByPlaceholderText("Write your answer here"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send to teacher/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/do not have permission/i);
  });
});

describe("homework already with the teacher", () => {
  /**
   * The policy only lets a student edit a submission while it is a draft, so a
   * writable box here would be a promise the database refuses to keep.
   */
  it("cannot be edited once sent", () => {
    setup(snapshot({ homework: [homework({ state: "submitted", body: "sent" })] }));
    expect(screen.queryByPlaceholderText("Write your answer here")).toBeNull();
    expect(screen.getByText("With your teacher")).toBeDefined();
    expect(screen.getByText("sent")).toBeDefined();
  });

  it("says feedback has not arrived rather than showing an empty panel", () => {
    setup(snapshot({ homework: [homework({ state: "submitted", body: "sent" })] }));
    expect(screen.getByText(/has not sent feedback yet/i)).toBeDefined();
  });

  it("shows the feedback once it has been released", () => {
    setup(
      snapshot({
        homework: [
          homework({
            state: "returned",
            body: "sent",
            feedback: "Strong use of the past simple.",
            feedbackReleasedAt: NOW.toISOString(),
          }),
        ],
      }),
    );
    expect(screen.getByText("Feedback ready")).toBeDefined();
    expect(screen.getByText("Strong use of the past simple.")).toBeDefined();
  });
});

describe("progress, one model per track", () => {
  it("shows CEFR percentages for an ESL learner, and a dash for what was not observed", () => {
    setup(
      snapshot({
        progress: {
          track: "ESL",
          entries: [
            {
              id: "e1",
              recordedAt: NOW.toISOString(),
              scores: { speaking: 72 },
              note: "Much more confident in open questions.",
            },
          ],
        },
      }),
    );
    expect(screen.getByText("72%")).toBeDefined();
    // Grammar was not recorded; it must not read as 0%.
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Much more confident in open questions."),
    ).toBeDefined();
  });

  it("shows bands for an IELTS candidate, and never a percentage", () => {
    setup(
      snapshot({
        learner: {
          studentId: "student-2",
          workspaceId: "workspace-1",
          fullName: "Grace Hopper",
          track: "IELTS",
        },
        progress: {
          track: "IELTS",
          bands: [
            {
              id: "b1",
              recordedAt: NOW.toISOString(),
              skill: "Writing",
              band: 6.5,
            },
          ],
        },
      }),
    );
    expect(screen.getByText("6.5")).toBeDefined();
    expect(screen.queryByText("Grammar")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* The owner's side                                                    */
/* ------------------------------------------------------------------ */

const learner = (over: Partial<StudentSignal> = {}): StudentSignal => ({
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

describe("granting a learner access", () => {
  const access = (students = [learner()]) =>
    render(<LearnerAccess track="ESL" students={students} />);

  it("offers access to a learner who has none", () => {
    access();
    expect(screen.getByText(/no login/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /give access/i })).toBeDefined();
  });

  it("offers to revoke from a learner who already has a login", () => {
    access([learner({ hasLogin: true })]);
    expect(screen.getByRole("button", { name: /revoke/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /give access/i })).toBeNull();
  });

  it("shows only this track's learners", () => {
    access([learner(), learner({ studentId: "s2", name: "Grace Hopper", track: "IELTS" })]);
    expect(screen.queryByText("Grace Hopper")).toBeNull();
  });

  it("sends the email the owner typed", async () => {
    linkStudentAccount.mockResolvedValue(ok({ userId: "user-1" }));
    access();
    fireEvent.click(screen.getByRole("button", { name: /give access/i }));
    fireEvent.change(screen.getByPlaceholderText("them@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => expect(linkStudentAccount).toHaveBeenCalledTimes(1));
    expect(linkStudentAccount.mock.calls[0][0]).toEqual({
      studentId: "student-1",
      email: "ada@example.com",
    });
  });

  /** The expected first outcome, and it has to read as an instruction. */
  it("passes the database's explanation straight through", async () => {
    linkStudentAccount.mockResolvedValue({
      ok: false,
      error:
        "No account uses that email address yet. Ask them to sign up first, then link them.",
    });
    access();
    fireEvent.click(screen.getByRole("button", { name: /give access/i }));
    fireEvent.change(screen.getByPlaceholderText("them@example.com"), {
      target: { value: "nobody@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/ask them to sign up first/i);
  });

  it("says plainly that revoking leaves the teaching records alone", async () => {
    unlinkStudentAccount.mockResolvedValue(ok());
    access([learner({ hasLogin: true })]);
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(unlinkStudentAccount).toHaveBeenCalledWith("student-1"));
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/untouched/i);
  });
});
