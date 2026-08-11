/**
 * Portal access: who gets it, who grants it, and what it reaches.
 *
 * `rls.test.ts` proves the policies are right for students who are *already*
 * linked. This covers the act of linking itself, which is new surface and the
 * most dangerous kind: a definer function that reads `auth.users` by email.
 * SECURITY DEFINER means RLS does not run, so the only thing standing between a
 * teacher and every email address in the system is the explicit owner check
 * inside the function body.
 *
 * The isolation assertions are repeated here rather than assumed, because the
 * portal is the first surface where a student's own session drives real reads.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, isDenied, queryAs, type TestDb } from "./harness";

let db: TestDb;

const ids = {
  owner: "",
  teacher: "",
  learnerUser1: "",
  learnerUser2: "",
  strangerUser: "",
  workspace: "",
  otherOwner: "",
  otherWorkspace: "",
  learner1: "",
  learner2: "",
  lesson1: "",
  assignment1: "",
  submission1: "",
  feedbackHeld: "",
};

const EMAIL = {
  learner1: "learner-one@portal.test",
  learner2: "learner-two@portal.test",
  teacher: "teacher@portal.test",
  nobody: "nobody@portal.test",
};

async function seed() {
  const one = async (sql: string, params: unknown[] = []) => {
    const { rows } = await db.sql(sql, params);
    return (rows[0] as { id: string }).id;
  };

  ids.owner = await one(
    `insert into auth.users (email) values ('owner@portal.test') returning id`,
  );
  ids.teacher = await one(
    `insert into auth.users (email) values ($1) returning id`,
    [EMAIL.teacher],
  );
  ids.learnerUser1 = await one(
    `insert into auth.users (email) values ($1) returning id`,
    [EMAIL.learner1],
  );
  ids.learnerUser2 = await one(
    `insert into auth.users (email) values ($1) returning id`,
    [EMAIL.learner2],
  );
  ids.strangerUser = await one(
    `insert into auth.users (email) values ('stranger@portal.test') returning id`,
  );
  ids.otherOwner = await one(
    `insert into auth.users (email) values ('other-owner@portal.test') returning id`,
  );

  ids.workspace = await one(
    `insert into public.workspaces (name, owner_id) values ('Portal Workspace', $1) returning id`,
    [ids.owner],
  );
  ids.otherWorkspace = await one(
    `insert into public.workspaces (name, owner_id) values ('Other Workspace', $1) returning id`,
    [ids.otherOwner],
  );

  await db.sql(
    `insert into public.workspace_members (workspace_id, user_id, role)
     values ($1, $2, 'owner'), ($1, $3, 'teacher'), ($4, $5, 'owner')`,
    [ids.workspace, ids.owner, ids.teacher, ids.otherWorkspace, ids.otherOwner],
  );

  ids.learner1 = await one(
    `insert into public.students (workspace_id, track, full_name) values ($1, 'esl', 'Learner One') returning id`,
    [ids.workspace],
  );
  ids.learner2 = await one(
    `insert into public.students (workspace_id, track, full_name) values ($1, 'ielts', 'Learner Two') returning id`,
    [ids.workspace],
  );

  // Records belonging to learner 1 only. Learner 2 must never reach any of them.
  ids.lesson1 = await one(
    `insert into public.lessons (workspace_id, student_id, track, starts_at, ends_at)
     values ($1, $2, 'esl', now(), now() + interval '1 hour') returning id`,
    [ids.workspace, ids.learner1],
  );
  ids.assignment1 = await one(
    `insert into public.homework_assignments (workspace_id, student_id, track, title, assigned_by)
     values ($1, $2, 'esl', 'Unit 6', $3) returning id`,
    [ids.workspace, ids.learner1, ids.owner],
  );
  ids.submission1 = await one(
    `insert into public.homework_submissions (workspace_id, assignment_id, student_id, body, status)
     values ($1, $2, $3, 'my answers', 'submitted') returning id`,
    [ids.workspace, ids.assignment1, ids.learner1],
  );
  // Written but never released. The learner must not see it.
  ids.feedbackHeld = await one(
    `insert into public.homework_feedback (workspace_id, submission_id, student_id, author_id, body)
     values ($1, $2, $3, $4, 'held back') returning id`,
    [ids.workspace, ids.submission1, ids.learner1, ids.owner],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  await seed();
});

afterAll(async () => {
  await db?.close();
});

/** Calls the linking function as `user`, keeping the write. */
const link = (user: string, studentId: string, email: string) =>
  queryAs(
    db,
    user,
    `select public.link_student_account($1, $2) as user_id`,
    [studentId, email],
    { commit: true },
  );

describe("granting portal access", () => {
  it("refuses a teacher, even for a learner they are assigned", async () => {
    await db.sql(
      `insert into public.teacher_student_assignments (workspace_id, teacher_user_id, student_id)
       values ($1, $2, $3)`,
      [ids.workspace, ids.teacher, ids.learner1],
    );

    await expect(
      link(ids.teacher, ids.learner1, EMAIL.learner1),
    ).rejects.toThrow(/only the workspace owner/i);
  });

  it("refuses an owner of a different workspace", async () => {
    await expect(
      link(ids.otherOwner, ids.learner1, EMAIL.learner1),
    ).rejects.toThrow(/only the workspace owner/i);
  });

  /**
   * The reason this function exists at all: the owner cannot look the address
   * up themselves, so the function must not become a way to discover whether an
   * arbitrary address is registered. It only ever answers for one learner the
   * caller already owns.
   */
  it("says plainly when nobody has signed up with that address", async () => {
    await expect(
      link(ids.owner, ids.learner1, EMAIL.nobody),
    ).rejects.toThrow(/no account uses that email/i);
  });

  it("refuses to make an existing teacher into a student", async () => {
    await expect(
      link(ids.owner, ids.learner1, EMAIL.teacher),
    ).rejects.toThrow(/already a teacher/i);
  });

  it("links the learner, ignoring case and surrounding space", async () => {
    const rows = await link(
      ids.owner,
      ids.learner1,
      `  ${EMAIL.learner1.toUpperCase()} `,
    );
    expect((rows[0] as { user_id: string }).user_id).toBe(ids.learnerUser1);

    const [account] = (await db.sql(
      `select user_id from public.student_accounts where student_id = $1`,
      [ids.learner1],
    )).rows as { user_id: string }[];
    expect(account.user_id).toBe(ids.learnerUser1);
  });

  /** Without this row the session cannot resolve and the portal never renders. */
  it("makes the learner a workspace member with the student role", async () => {
    const [membership] = (await db.sql(
      `select role from public.workspace_members where workspace_id = $1 and user_id = $2`,
      [ids.workspace, ids.learnerUser1],
    )).rows as { role: string }[];
    expect(membership.role).toBe("student");
  });

  /** Reworded from the raw constraint name, which a teacher cannot act on. */
  it("refuses to link a second login to the same learner", async () => {
    await expect(
      link(ids.owner, ids.learner1, EMAIL.learner2),
    ).rejects.toThrow(/already has a login/i);
  });
});

describe("what a linked learner reaches", () => {
  beforeAll(async () => {
    await link(ids.owner, ids.learner2, EMAIL.learner2);
  });

  it("reads their own record", async () => {
    const rows = await queryAs(
      db,
      ids.learnerUser1,
      `select full_name from public.students where id = $1`,
      [ids.learner1],
    );
    expect(rows).toHaveLength(1);
  });

  it("reads their own lesson and their own assignment", async () => {
    const lessons = await queryAs(
      db,
      ids.learnerUser1,
      `select id from public.lessons where id = $1`,
      [ids.lesson1],
    );
    const assignments = await queryAs(
      db,
      ids.learnerUser1,
      `select id from public.homework_assignments where id = $1`,
      [ids.assignment1],
    );
    expect(lessons).toHaveLength(1);
    expect(assignments).toHaveLength(1);
  });

  /** Feedback exists, and is deliberately invisible until the teacher releases. */
  it("cannot read feedback that has not been released", async () => {
    expect(
      await isDenied(
        db,
        ids.learnerUser1,
        `select id from public.homework_feedback where id = $1`,
        [ids.feedbackHeld],
      ),
    ).toBe(true);
  });

  it("reads the same feedback once it is released", async () => {
    await db.sql(
      `update public.homework_feedback set released_at = now() where id = $1`,
      [ids.feedbackHeld],
    );
    const rows = await queryAs(
      db,
      ids.learnerUser1,
      `select body from public.homework_feedback where id = $1`,
      [ids.feedbackHeld],
    );
    expect(rows).toHaveLength(1);
  });

  /** The isolation CLAUDE.md asks for, from the portal's own perspective. */
  it("reaches nothing belonging to the other learner", async () => {
    for (const [table, id] of [
      ["public.students", ids.learner1],
      ["public.lessons", ids.lesson1],
      ["public.homework_assignments", ids.assignment1],
      ["public.homework_submissions", ids.submission1],
      ["public.homework_feedback", ids.feedbackHeld],
    ] as const) {
      expect(
        await isDenied(
          db,
          ids.learnerUser2,
          `select id from ${table} where id = $1`,
          [id],
        ),
      ).toBe(true);
    }
  });

  it("is invisible to a signed-in user who was never linked", async () => {
    expect(
      await isDenied(
        db,
        ids.strangerUser,
        `select id from public.students where id = $1`,
        [ids.learner1],
      ),
    ).toBe(true);
  });

  it("cannot submit work on the other learner's behalf", async () => {
    let refused = false;
    try {
      await queryAs(
        db,
        ids.learnerUser2,
        `insert into public.homework_submissions (workspace_id, assignment_id, student_id, body, status)
         values ($1, $2, $3, 'not mine', 'submitted')`,
        [ids.workspace, ids.assignment1, ids.learner1],
      );
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });
});

describe("revoking portal access", () => {
  const unlink = (user: string, studentId: string) =>
    queryAs(
      db,
      user,
      `select public.unlink_student_account($1)`,
      [studentId],
      { commit: true },
    );

  it("refuses a teacher", async () => {
    await expect(unlink(ids.teacher, ids.learner1)).rejects.toThrow(
      /only the workspace owner/i,
    );
  });

  it("is not an error when nothing is linked", async () => {
    const orphan = (
      await db.sql(
        `insert into public.students (workspace_id, track, full_name)
         values ($1, 'esl', 'Never Linked') returning id`,
        [ids.workspace],
      )
    ).rows[0] as { id: string };
    await expect(unlink(ids.owner, orphan.id)).resolves.toBeDefined();
  });

  it("removes access but leaves the teaching records intact", async () => {
    await unlink(ids.owner, ids.learner1);

    expect(
      await isDenied(
        db,
        ids.learnerUser1,
        `select id from public.students where id = $1`,
        [ids.learner1],
      ),
    ).toBe(true);

    // The learner's history is untouched — this is "revoke access", not "delete
    // this person".
    const { rows } = await db.sql(
      `select id from public.homework_submissions where id = $1`,
      [ids.submission1],
    );
    expect(rows).toHaveLength(1);
  });

  it("removes the student membership it created", async () => {
    const { rows } = await db.sql(
      `select role from public.workspace_members where workspace_id = $1 and user_id = $2`,
      [ids.workspace, ids.learnerUser1],
    );
    expect(rows).toHaveLength(0);
  });
});
