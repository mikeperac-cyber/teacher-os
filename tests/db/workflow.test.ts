/**
 * The vertical slice, executed end to end against a real Postgres.
 *
 * CLAUDE.md defines the first production workflow as:
 *
 *   owner signs in → creates a student → schedules a lesson → records
 *   preparation → assigns homework → student signs in and submits → owner
 *   records feedback → owner updates track-specific progress → the next lesson
 *   shows the new homework and progress context
 *
 * Each step below runs as the person who should be performing it, with RLS
 * enforced. That is what makes this more than a CRUD test: it proves the
 * workflow is possible for the right actor *and* refused for the wrong one, at
 * every step, rather than only at the boundaries.
 *
 * The server actions in `lib/actions/workflow.ts` issue exactly these writes.
 * They cannot run here — they depend on Next's request context — so this covers
 * the layer underneath them, which is where the authorization lives.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestDb,
  isDenied,
  queryAs,
  writeAs,
  type TestDb,
} from "./harness";

let db: TestDb;

const ids = {
  owner: "",
  teacher: "",
  studentUser: "",
  otherStudentUser: "",
  workspace: "",
  student: "",
  otherStudent: "",
  lesson: "",
  assignment: "",
  submission: "",
};

beforeAll(async () => {
  db = await createTestDb();

  const one = async (sql: string, params: unknown[] = []) => {
    const { rows } = await db.sql(sql, params);
    return (rows[0] as { id: string }).id;
  };

  ids.owner = await one(
    `insert into auth.users (email) values ('owner@example.test') returning id`,
  );
  ids.teacher = await one(
    `insert into auth.users (email) values ('teacher@example.test') returning id`,
  );
  ids.studentUser = await one(
    `insert into auth.users (email) values ('learner@example.test') returning id`,
  );
  ids.otherStudentUser = await one(
    `insert into auth.users (email) values ('other@example.test') returning id`,
  );

  ids.workspace = await one(
    `insert into public.workspaces (name, owner_id) values ('Teaching', $1) returning id`,
    [ids.owner],
  );

  await db.sql(
    `insert into public.workspace_members (workspace_id, user_id, role)
     values ($1, $2, 'owner'), ($1, $3, 'teacher'), ($1, $4, 'student'), ($1, $5, 'student')`,
    [
      ids.workspace,
      ids.owner,
      ids.teacher,
      ids.studentUser,
      ids.otherStudentUser,
    ],
  );
}, 120_000);

afterAll(async () => {
  await db?.close();
});

/**
 * Regression guard for a bug this suite found.
 *
 * `INSERT ... RETURNING` applies the SELECT policy to the row it returns. When
 * the students SELECT policy called `can_access_student`, which queries
 * `students` itself, the STABLE function evaluated against the statement-start
 * snapshot and could not see the row being inserted. A bare INSERT succeeded
 * and `INSERT ... RETURNING` failed — and `.insert().select()` is exactly what
 * the Supabase client emits, so every create in `lib/actions/workflow.ts` would
 * have failed in production.
 *
 * The policy now reads `workspace_id` from the candidate row instead of
 * re-querying the table. Any future policy that self-references will fail here.
 */
describe("insert ... returning", () => {
  it("returns the inserted student to its creator", async () => {
    const rows = await queryAs(
      db,
      ids.owner,
      `insert into public.students (workspace_id, track, full_name)
       values ($1, 'esl', 'Returning Probe') returning id, full_name`,
      [ids.workspace],
    );
    expect(rows).toHaveLength(1);
  });
});

/**
 * `create_student` writes the learner and their track profile in one
 * transaction. Two client calls cannot share one, and a learner with no profile
 * is a broken record that nothing surfaces.
 */
describe("create_student", () => {
  it("creates an IELTS candidate and their profile together", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `select public.create_student($1, 'ielts', 'Atomic Candidate', '7.0', current_date + 40) as id`,
      [ids.workspace],
    )) as { id: string }[];

    const created = rows[0].id;
    expect(created).toBeTruthy();

    const profile = await queryAs(
      db,
      ids.owner,
      `select target_band, test_date from public.ielts_student_profiles where student_id = $1`,
      [created],
    );
    expect(profile).toHaveLength(1);
  });

  it("creates an ESL learner with a CEFR profile instead", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `select public.create_student($1, 'esl', 'Atomic Learner', 'B2') as id`,
      [ids.workspace],
    )) as { id: string }[];

    const esl = await queryAs(
      db,
      ids.owner,
      `select target_cefr from public.esl_student_profiles where student_id = $1`,
      [rows[0].id],
    );
    expect(esl).toHaveLength(1);

    // The IELTS profile table must stay untouched for an ESL learner.
    const ielts = await queryAs(
      db,
      ids.owner,
      `select id from public.ielts_student_profiles where student_id = $1`,
      [rows[0].id],
    );
    expect(ielts).toEqual([]);
  });

  /** The whole reason this is a function: no half-created learner. */
  it("leaves no student behind when the profile is invalid", async () => {
    const before = (await queryAs(
      db,
      ids.owner,
      `select count(*)::int as n from public.students`,
    )) as { n: number }[];

    await expect(
      writeAs(
        db,
        ids.owner,
        `select public.create_student($1, 'ielts', 'Rolled Back', '6.3') as id`,
        [ids.workspace],
      ),
    ).rejects.toThrow();

    const after = (await queryAs(
      db,
      ids.owner,
      `select count(*)::int as n from public.students`,
    )) as { n: number }[];

    expect(after[0].n).toBe(before[0].n);
  });

  it("refuses a blank name", async () => {
    await expect(
      writeAs(
        db,
        ids.owner,
        `select public.create_student($1, 'esl', '   ') as id`,
        [ids.workspace],
      ),
    ).rejects.toThrow();
  });

  /** SECURITY INVOKER, so RLS still applies inside the function. */
  it("refuses a teacher, because it runs with the caller's privileges", async () => {
    await expect(
      writeAs(
        db,
        ids.teacher,
        `select public.create_student($1, 'esl', 'Teacher Attempt') as id`,
        [ids.workspace],
      ),
    ).rejects.toThrow();
  });
});

describe("step 1 — the owner creates a student", () => {
  it("creates the learner and their track profile", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `insert into public.students (workspace_id, track, full_name)
       values ($1, 'ielts', 'Vertical Slice') returning id`,
      [ids.workspace],
    )) as { id: string }[];

    expect(rows).toHaveLength(1);
    ids.student = rows[0].id;

    const profile = await writeAs(
      db,
      ids.owner,
      `insert into public.ielts_student_profiles (workspace_id, student_id, target_band, test_date)
       values ($1, $2, 7.0, current_date + 60) returning id`,
      [ids.workspace, ids.student],
    );
    expect(profile).toHaveLength(1);
  });

  it("rejects a band outside the official scale", async () => {
    // The band_score domain, not application code.
    await expect(
      queryAs(
        db,
        ids.owner,
        `update public.ielts_student_profiles set target_band = 6.3 where student_id = $1 returning id`,
        [ids.student],
      ),
    ).rejects.toThrow();
  });

  it("refuses a teacher creating a student", async () => {
    expect(
      await isDenied(
        db,
        ids.teacher,
        `insert into public.students (workspace_id, track, full_name)
         values ($1, 'esl', 'Should Not Exist') returning id`,
        [ids.workspace],
      ),
    ).toBe(true);
  });
});

describe("step 1b — linking the learner to a login", () => {
  it("lets the owner link the account", async () => {
    const rows = await writeAs(
      db,
      ids.owner,
      `insert into public.student_accounts (student_id, user_id, workspace_id)
       values ($1, $2, $3) returning id`,
      [ids.student, ids.studentUser, ids.workspace],
    );
    expect(rows).toHaveLength(1);
  });

  it("lets the linked learner see their own record, and nobody else's", async () => {
    const own = (await queryAs(
      db,
      ids.studentUser,
      `select full_name from public.students`,
    )) as { full_name: string }[];
    expect(own.map((r) => r.full_name)).toEqual(["Vertical Slice"]);

    expect(
      await isDenied(
        db,
        ids.otherStudentUser,
        `select id from public.students where id = $1`,
        [ids.student],
      ),
    ).toBe(true);
  });
});

describe("step 2 — the owner schedules a lesson", () => {
  it("schedules it", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `insert into public.lessons (workspace_id, student_id, track, starts_at, ends_at)
       values ($1, $2, 'ielts', now() + interval '2 days', now() + interval '2 days 1 hour')
       returning id`,
      [ids.workspace, ids.student],
    )) as { id: string }[];

    expect(rows).toHaveLength(1);
    ids.lesson = rows[0].id;
  });

  it("refuses a lesson that ends before it starts", async () => {
    await expect(
      queryAs(
        db,
        ids.owner,
        `insert into public.lessons (workspace_id, student_id, track, starts_at, ends_at)
         values ($1, $2, 'ielts', now() + interval '3 days', now() + interval '2 days')
         returning id`,
        [ids.workspace, ids.student],
      ),
    ).rejects.toThrow();
  });

  it("shows the lesson to the learner", async () => {
    const rows = await queryAs(
      db,
      ids.studentUser,
      `select id from public.lessons where id = $1`,
      [ids.lesson],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("step 3 — the owner prepares the lesson", () => {
  it("saves the plan", async () => {
    const rows = await writeAs(
      db,
      ids.owner,
      `insert into public.lesson_plans (workspace_id, lesson_id, student_id, track, objective)
       values ($1, $2, $3, 'ielts', 'Move Task Response from Band 6 to Band 7')
       returning id`,
      [ids.workspace, ids.lesson, ids.student],
    );
    expect(rows).toHaveLength(1);
  });

  /** Preparation is working material; the learner never sees it. */
  it("keeps the plan invisible to the learner", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser,
        `select id from public.lesson_plans where lesson_id = $1`,
        [ids.lesson],
      ),
    ).toBe(true);
  });
});

describe("step 4 — the owner assigns homework", () => {
  it("assigns work that blocks the lesson", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `insert into public.homework_assignments
         (workspace_id, student_id, track, title, blocks_lesson_id, due_at, assigned_by)
       values ($1, $2, 'ielts', 'Timed Task 2 response', $3, now() + interval '1 day', $4)
       returning id`,
      [ids.workspace, ids.student, ids.lesson, ids.owner],
    )) as { id: string }[];

    expect(rows).toHaveLength(1);
    ids.assignment = rows[0].id;
  });

  it("cannot be attributed to someone else", async () => {
    // assigned_by must equal the caller, per the insert policy.
    expect(
      await isDenied(
        db,
        ids.owner,
        `insert into public.homework_assignments
           (workspace_id, student_id, track, title, assigned_by)
         values ($1, $2, 'ielts', 'Attributed to the teacher', $3) returning id`,
        [ids.workspace, ids.student, ids.teacher],
      ),
    ).toBe(true);
  });

  it("is visible to the learner", async () => {
    const rows = await queryAs(
      db,
      ids.studentUser,
      `select title from public.homework_assignments where id = $1`,
      [ids.assignment],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("step 5 — the learner submits", () => {
  it("saves a draft first", async () => {
    const rows = (await writeAs(
      db,
      ids.studentUser,
      `insert into public.homework_submissions (workspace_id, assignment_id, student_id, status, body)
       values ($1, $2, $3, 'draft', 'first attempt') returning id, submitted_at`,
      [ids.workspace, ids.assignment, ids.student],
    )) as { id: string; submitted_at: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].submitted_at).toBeNull();
    ids.submission = rows[0].id;
  });

  it("submits, and the timestamp comes from the trigger", async () => {
    const rows = (await writeAs(
      db,
      ids.studentUser,
      `update public.homework_submissions set status = 'submitted', body = 'final answer'
       where id = $1 returning submitted_at`,
      [ids.submission],
    )) as { submitted_at: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].submitted_at).not.toBeNull();
  });

  it("locks the learner out once submitted", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser,
        `update public.homework_submissions set body = 'sneaking a change in'
         where id = $1 returning id`,
        [ids.submission],
      ),
    ).toBe(true);
  });

  it("refuses another learner submitting on their behalf", async () => {
    expect(
      await isDenied(
        db,
        ids.otherStudentUser,
        `update public.homework_submissions set body = 'not mine' where id = $1 returning id`,
        [ids.submission],
      ),
    ).toBe(true);
  });
});

describe("step 6 — the owner gives feedback", () => {
  it("writes it unreleased, and the learner cannot see it yet", async () => {
    const rows = await writeAs(
      db,
      ids.owner,
      `insert into public.homework_feedback (workspace_id, submission_id, student_id, author_id, body)
       values ($1, $2, $3, $4, 'Position is clear; develop the second example.')
       returning id`,
      [ids.workspace, ids.submission, ids.student, ids.owner],
    );
    expect(rows).toHaveLength(1);

    expect(
      await isDenied(
        db,
        ids.studentUser,
        `select id from public.homework_feedback where submission_id = $1`,
        [ids.submission],
      ),
    ).toBe(true);
  });

  it("becomes visible once released", async () => {
    await writeAs(
      db,
      ids.owner,
      `update public.homework_feedback set released_at = now()
       where submission_id = $1 returning id`,
      [ids.submission],
    );

    const rows = await queryAs(
      db,
      ids.studentUser,
      `select body from public.homework_feedback where submission_id = $1`,
      [ids.submission],
    );
    expect(rows).toHaveLength(1);
  });

  it("lets the owner return the work", async () => {
    const rows = (await writeAs(
      db,
      ids.owner,
      `update public.homework_submissions set status = 'returned'
       where id = $1 returning returned_at`,
      [ids.submission],
    )) as { returned_at: string | null }[];

    expect(rows[0].returned_at).not.toBeNull();
  });
});

describe("step 7 — the owner updates track-specific progress", () => {
  it("records IELTS bands on the official scale", async () => {
    const rows = await writeAs(
      db,
      ids.owner,
      `insert into public.ielts_skill_scores (workspace_id, student_id, skill, band, recorded_by)
       values ($1, $2, 'writing', 6.5, $3), ($1, $2, 'speaking', 6.0, $3)
       returning id`,
      [ids.workspace, ids.student, ids.owner],
    );
    expect(rows).toHaveLength(2);
  });

  it("refuses a band that is not a half step", async () => {
    await expect(
      queryAs(
        db,
        ids.owner,
        `insert into public.ielts_skill_scores (workspace_id, student_id, skill, band, recorded_by)
         values ($1, $2, 'reading', 6.3, $3) returning id`,
        [ids.workspace, ids.student, ids.owner],
      ),
    ).rejects.toThrow();
  });

  it("withholds unreleased bands from the learner", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser,
        `select id from public.ielts_skill_scores where student_id = $1`,
        [ids.student],
      ),
    ).toBe(true);
  });

  it("refuses the learner recording their own bands", async () => {
    expect(
      await isDenied(
        db,
        ids.studentUser,
        `insert into public.ielts_skill_scores (workspace_id, student_id, skill, band, recorded_by)
         values ($1, $2, 'writing', 9.0, $3) returning id`,
        [ids.workspace, ids.student, ids.studentUser],
      ),
    ).toBe(true);
  });

  /**
   * CLAUDE.md rule 5, enforced by the schema: an IELTS candidate's progress
   * cannot accidentally be written into the ESL mastery table as a percentage.
   * Nothing stops the insert structurally — the guard is that they are separate
   * tables, so a generic "record progress" path cannot exist by accident.
   */
  it("keeps ESL mastery and IELTS bands in different tables", async () => {
    const { rows } = await db.sql(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'band'`,
    );
    const bandTables = rows.map((r) => (r as { table_name: string }).table_name);
    expect(bandTables).toContain("ielts_skill_scores");
    expect(bandTables).not.toContain("esl_progress_entries");
  });
});

describe("step 8 — the next lesson shows the new context", () => {
  it("gives the owner the returned homework and the recorded bands", async () => {
    const context = (await queryAs(
      db,
      ids.owner,
      `select
         (select count(*) from public.homework_submissions
           where student_id = $1 and status = 'returned') as returned_work,
         (select count(*) from public.ielts_skill_scores
           where student_id = $1) as bands,
         (select count(*) from public.lesson_plans
           where lesson_id = $2) as plans`,
      [ids.student, ids.lesson],
    )) as { returned_work: string; bands: string; plans: string }[];

    expect(Number(context[0].returned_work)).toBe(1);
    expect(Number(context[0].bands)).toBe(2);
    expect(Number(context[0].plans)).toBe(1);
  });

  it("gives the learner their released feedback but not the plan or bands", async () => {
    const feedback = await queryAs(
      db,
      ids.studentUser,
      `select id from public.homework_feedback where student_id = $1`,
      [ids.student],
    );
    expect(feedback).toHaveLength(1);

    expect(
      await isDenied(
        db,
        ids.studentUser,
        `select id from public.lesson_plans where student_id = $1`,
        [ids.student],
      ),
    ).toBe(true);
  });

  /**
   * The teacher was never assigned this learner, so the entire workflow above
   * is invisible to them — the single most important property of the whole
   * schema.
   */
  it("shows none of it to an unassigned teacher", async () => {
    for (const table of [
      "students",
      "lessons",
      "lesson_plans",
      "homework_assignments",
      "homework_submissions",
      "homework_feedback",
      "ielts_skill_scores",
    ]) {
      const rows = await queryAs(
        db,
        ids.teacher,
        `select id from public.${table}`,
      );
      expect(rows, `${table} leaked to an unassigned teacher`).toEqual([]);
    }
  });
});
