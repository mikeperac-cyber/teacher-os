/**
 * The permission boundary, tested against a real Postgres.
 *
 * CLAUDE.md requires data isolation to be proven with two teachers and two
 * students. That is the fixture below, plus a second workspace, because
 * cross-tenant leakage and cross-teacher leakage are different bugs.
 *
 * Every assertion runs as a specific user with `set local role authenticated`,
 * so the policies are enforced by Postgres exactly as they will be in
 * production. Nothing here uses a service-role connection — a test that bypasses
 * RLS to check RLS proves nothing.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, isDenied, queryAs, type TestDb } from "./harness";

let db: TestDb;

/** Everyone and everything the assertions refer to. */
const ids = {
  ownerA: "" as string,
  teacher1: "",
  teacher2: "",
  studentUser1: "",
  studentUser2: "",
  ownerB: "",
  workspaceA: "",
  workspaceB: "",
  student1: "",
  student2: "",
  student3: "",
  lesson1: "",
  plan1: "",
  assignment1: "",
  assignment2: "",
  submission1: "",
  submission2: "",
  feedbackDraft: "",
  feedbackReleased: "",
  ownerTask: "",
};

async function seed() {
  const one = async (sql: string, params: unknown[] = []) => {
    const { rows } = await db.sql(sql, params);
    return (rows[0] as { id: string }).id;
  };

  // --- people -------------------------------------------------------------
  // Inserting into auth.users fires the profile trigger, as signup does.
  ids.ownerA = await one(
    `insert into auth.users (email) values ('owner-a@example.test') returning id`,
  );
  ids.teacher1 = await one(
    `insert into auth.users (email) values ('teacher-1@example.test') returning id`,
  );
  ids.teacher2 = await one(
    `insert into auth.users (email) values ('teacher-2@example.test') returning id`,
  );
  ids.studentUser1 = await one(
    `insert into auth.users (email) values ('student-1@example.test') returning id`,
  );
  ids.studentUser2 = await one(
    `insert into auth.users (email) values ('student-2@example.test') returning id`,
  );
  ids.ownerB = await one(
    `insert into auth.users (email) values ('owner-b@example.test') returning id`,
  );

  // --- workspaces ---------------------------------------------------------
  ids.workspaceA = await one(
    `insert into public.workspaces (name, owner_id) values ('Workspace A', $1) returning id`,
    [ids.ownerA],
  );
  ids.workspaceB = await one(
    `insert into public.workspaces (name, owner_id) values ('Workspace B', $1) returning id`,
    [ids.ownerB],
  );

  const member = (ws: string, user: string, role: string) =>
    db.sql(
      `insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`,
      [ws, user, role],
    );

  await member(ids.workspaceA, ids.ownerA, "owner");
  await member(ids.workspaceA, ids.teacher1, "teacher");
  await member(ids.workspaceA, ids.teacher2, "teacher");
  await member(ids.workspaceA, ids.studentUser1, "student");
  await member(ids.workspaceA, ids.studentUser2, "student");
  await member(ids.workspaceB, ids.ownerB, "owner");

  // --- students -----------------------------------------------------------
  ids.student1 = await one(
    `insert into public.students (workspace_id, track, full_name) values ($1, 'esl', 'Student One') returning id`,
    [ids.workspaceA],
  );
  ids.student2 = await one(
    `insert into public.students (workspace_id, track, full_name) values ($1, 'ielts', 'Student Two') returning id`,
    [ids.workspaceA],
  );
  ids.student3 = await one(
    `insert into public.students (workspace_id, track, full_name) values ($1, 'esl', 'Other Tenant') returning id`,
    [ids.workspaceB],
  );

  // Teacher 1 gets student 1; teacher 2 gets student 2. Neither gets both.
  await db.sql(
    `insert into public.teacher_student_assignments (workspace_id, teacher_user_id, student_id)
     values ($1, $2, $3), ($1, $4, $5)`,
    [ids.workspaceA, ids.teacher1, ids.student1, ids.teacher2, ids.student2],
  );

  await db.sql(
    `insert into public.student_accounts (student_id, user_id, workspace_id)
     values ($1, $2, $3), ($4, $5, $3)`,
    [
      ids.student1,
      ids.studentUser1,
      ids.workspaceA,
      ids.student2,
      ids.studentUser2,
    ],
  );

  // --- teaching records ---------------------------------------------------
  ids.lesson1 = await one(
    `insert into public.lessons (workspace_id, student_id, track, starts_at, ends_at)
     values ($1, $2, 'esl', now() + interval '1 day', now() + interval '1 day 1 hour')
     returning id`,
    [ids.workspaceA, ids.student1],
  );

  ids.plan1 = await one(
    `insert into public.lesson_plans (workspace_id, lesson_id, student_id, track, objective)
     values ($1, $2, $3, 'esl', 'Narrate a past event') returning id`,
    [ids.workspaceA, ids.lesson1, ids.student1],
  );

  ids.assignment1 = await one(
    `insert into public.homework_assignments (workspace_id, student_id, track, title, assigned_by)
     values ($1, $2, 'esl', 'Unit 6 vocabulary', $3) returning id`,
    [ids.workspaceA, ids.student1, ids.ownerA],
  );
  ids.assignment2 = await one(
    `insert into public.homework_assignments (workspace_id, student_id, track, title, assigned_by)
     values ($1, $2, 'ielts', 'Task 2 essay', $3) returning id`,
    [ids.workspaceA, ids.student2, ids.ownerA],
  );

  ids.submission1 = await one(
    `insert into public.homework_submissions (workspace_id, assignment_id, student_id, status, body)
     values ($1, $2, $3, 'draft', 'draft answer') returning id`,
    [ids.workspaceA, ids.assignment1, ids.student1],
  );
  ids.submission2 = await one(
    `insert into public.homework_submissions (workspace_id, assignment_id, student_id, status, body)
     values ($1, $2, $3, 'submitted', 'student two answer') returning id`,
    [ids.workspaceA, ids.assignment2, ids.student2],
  );

  // One unreleased and one released piece of feedback.
  ids.feedbackDraft = await one(
    `insert into public.homework_feedback (workspace_id, submission_id, student_id, author_id, body)
     values ($1, $2, $3, $4, 'Still drafting this') returning id`,
    [ids.workspaceA, ids.submission2, ids.student2, ids.ownerA],
  );
  ids.feedbackReleased = await one(
    `insert into public.homework_feedback (workspace_id, submission_id, student_id, author_id, body, released_at)
     values ($1, $2, $3, $4, 'Good work', now()) returning id`,
    [ids.workspaceA, ids.submission1, ids.student1, ids.ownerA],
  );

  ids.ownerTask = await one(
    `insert into public.tasks (workspace_id, owner_id, title) values ($1, $2, 'Owner private task') returning id`,
    [ids.workspaceA, ids.ownerA],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  await seed();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const studentNames = async (userId: string) =>
  (
    (await queryAs(
      db,
      userId,
      `select full_name from public.students order by full_name`,
    )) as { full_name: string }[]
  ).map((r) => r.full_name);

describe("workspace isolation", () => {
  it("an owner sees only their own workspace's students", async () => {
    expect(await studentNames(ids.ownerA)).toEqual(["Student One", "Student Two"]);
    expect(await studentNames(ids.ownerB)).toEqual(["Other Tenant"]);
  });

  it("an owner cannot read another tenant's student by direct id", async () => {
    expect(
      await isDenied(
        db,
        ids.ownerA,
        `select id from public.students where id = $1`,
        [ids.student3],
      ),
    ).toBe(true);
  });

  it("an owner cannot read another tenant's workspace", async () => {
    expect(
      await isDenied(
        db,
        ids.ownerA,
        `select id from public.workspaces where id = $1`,
        [ids.workspaceB],
      ),
    ).toBe(true);
  });
});

describe("teacher scoping", () => {
  it("a teacher sees only the students assigned to them", async () => {
    expect(await studentNames(ids.teacher1)).toEqual(["Student One"]);
    expect(await studentNames(ids.teacher2)).toEqual(["Student Two"]);
  });

  it("a teacher cannot read another teacher's student by direct id", async () => {
    expect(
      await isDenied(
        db,
        ids.teacher1,
        `select id from public.students where id = $1`,
        [ids.student2],
      ),
    ).toBe(true);
  });

  it("a teacher cannot read another teacher's student's homework", async () => {
    expect(
      await isDenied(
        db,
        ids.teacher1,
        `select id from public.homework_assignments where student_id = $1`,
        [ids.student2],
      ),
    ).toBe(true);
  });

  /** Otherwise a teacher could grant themselves the whole roster. */
  it("a teacher cannot assign themselves to another student", async () => {
    await expect(
      queryAs(
        db,
        ids.teacher1,
        `insert into public.teacher_student_assignments (workspace_id, teacher_user_id, student_id)
         values ($1, $2, $3) returning id`,
        [ids.workspaceA, ids.teacher1, ids.student2],
      ),
    ).rejects.toThrow();
  });

  it("a teacher cannot promote themselves to owner", async () => {
    // Denied by USING, so the row is never selected for update and the
    // statement affects nothing. See the note above `isDenied`.
    expect(
      await isDenied(
        db,
        ids.teacher1,
        `update public.workspace_members set role = 'owner'
         where user_id = $1 and workspace_id = $2 returning id`,
        [ids.teacher1, ids.workspaceA],
      ),
    ).toBe(true);
  });
});

describe("student access", () => {
  it("a student sees only their own record", async () => {
    expect(await studentNames(ids.studentUser1)).toEqual(["Student One"]);
  });

  it("a student cannot read another student's submission by direct id", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser1,
        `select id from public.homework_submissions where id = $1`,
        [ids.submission2],
      ),
    ).toBe(true);
  });

  it("a student can read their own lessons", async () => {
    const rows = await queryAs(
      db,
      ids.studentUser1,
      `select id from public.lessons`,
    );
    expect(rows).toHaveLength(1);
  });

  /** Teacher preparation is working material and stays private. */
  it("a student cannot read lesson plans at all, including their own", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser1,
        `select id from public.lesson_plans`,
      ),
    ).toBe(true);
  });

  it("a student cannot read a teacher's task list", async () => {
    expect(
      await isDenied(db, ids.studentUser1, `select id from public.tasks`),
    ).toBe(true);
  });
});

describe("feedback release gate", () => {
  it("a student cannot read feedback that has not been released", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser2,
        `select id from public.homework_feedback where id = $1`,
        [ids.feedbackDraft],
      ),
    ).toBe(true);
  });

  it("a student can read their feedback once released", async () => {
    const rows = await queryAs(
      db,
      ids.studentUser1,
      `select id from public.homework_feedback where id = $1`,
      [ids.feedbackReleased],
    );
    expect(rows).toHaveLength(1);
  });

  it("a teacher sees unreleased feedback for their own student", async () => {
    const rows = await queryAs(
      db,
      ids.teacher2,
      `select id from public.homework_feedback where id = $1`,
      [ids.feedbackDraft],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("submission write boundary", () => {
  it("a student may edit their own draft", async () => {
    const rows = await queryAs(
      db,
      ids.studentUser1,
      `update public.homework_submissions set body = 'revised'
       where id = $1 returning id`,
      [ids.submission1],
    );
    expect(rows).toHaveLength(1);
  });

  /**
   * The escalation this policy exists to stop.
   *
   * These are refused by WITH CHECK rather than USING: the row is still a
   * draft, so the student is allowed to edit it, but 'returned' is not a value
   * they may write. Postgres raises in that case instead of quietly matching
   * nothing, which is the stronger of the two denial shapes.
   */
  it("a student cannot mark their own homework returned", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser1,
        `update public.homework_submissions set status = 'returned'
         where id = $1 returning id`,
        [ids.submission1],
      ),
    ).toBe(true);
  });

  it("a student cannot move their own homework into checking", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser1,
        `update public.homework_submissions set status = 'checking'
         where id = $1 returning id`,
        [ids.submission1],
      ),
    ).toBe(true);
  });

  it("a student may submit a draft, and then cannot touch it again", async () => {
    await db.asUser(ids.studentUser1, async (scoped) => {
      const submitted = await scoped.sql(
        `update public.homework_submissions set status = 'submitted'
         where id = $1 returning id, submitted_at`,
        [ids.submission1],
      );
      expect(submitted.rows).toHaveLength(1);
      // The timestamp comes from the trigger, not the client.
      expect(
        (submitted.rows[0] as { submitted_at: unknown }).submitted_at,
      ).not.toBeNull();

      const afterwards = await scoped.sql(
        `update public.homework_submissions set body = 'sneaking an edit in'
         where id = $1 returning id`,
        [ids.submission1],
      );
      expect(afterwards.rows).toEqual([]);
    });
  });

  it("a student cannot write a submission for another student", async () => {
    await expect(
      queryAs(
        db,
        ids.studentUser1,
        `insert into public.homework_submissions (workspace_id, assignment_id, student_id, status)
         values ($1, $2, $3, 'draft') returning id`,
        [ids.workspaceA, ids.assignment2, ids.student2],
      ),
    ).rejects.toThrow();
  });

  it("a student cannot record their own progress", async () => {
    await expect(
      queryAs(
        db,
        ids.studentUser1,
        `insert into public.esl_progress_entries (workspace_id, student_id, recorded_by, overall)
         values ($1, $2, $3, 100) returning id`,
        [ids.workspaceA, ids.student1, ids.studentUser1],
      ),
    ).rejects.toThrow();
  });
});

describe("anonymous access", () => {
  it("an unauthenticated request reads nothing", async () => {
    // No jwt claim set: auth.uid() is null and every policy fails.
    for (const table of [
      "students",
      "lessons",
      "homework_submissions",
      "homework_feedback",
      "esl_progress_entries",
    ]) {
      const rows = await queryAs(db, "", `select id from public.${table}`);
      expect(rows, `${table} leaked to an anonymous request`).toEqual([]);
    }
  });
});
