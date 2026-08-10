/**
 * Proves the migrations apply cleanly, and that RLS is switched on everywhere.
 *
 * The second assertion is the one that catches real mistakes: it is easy to add
 * a table in a later migration and forget `enable row level security`, and the
 * result is a table readable by every authenticated user in every workspace.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("migrations", () => {
  it("apply cleanly to an empty database", async () => {
    const { rows } = await db.sql(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    const names = rows.map((r) => (r as { table_name: string }).table_name);

    expect(names).toContain("profiles");
    expect(names).toContain("workspaces");
    expect(names).toContain("students");
    expect(names).toContain("lessons");
    expect(names).toContain("homework_submissions");
  });

  it("enables row level security on every public table", async () => {
    const { rows } = await db.sql(
      `select c.relname as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and c.relrowsecurity = false
       order by c.relname`,
    );
    expect(rows.map((r) => (r as { table_name: string }).table_name)).toEqual([]);
  });

  it("gives every public table at least one policy", async () => {
    const { rows } = await db.sql(
      `select c.relname as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not exists (
           select 1 from pg_policy p where p.polrelid = c.oid
         )
       order by c.relname`,
    );
    expect(rows.map((r) => (r as { table_name: string }).table_name)).toEqual([]);
  });

  /**
   * A SECURITY DEFINER function without a pinned search_path can be hijacked by
   * a caller who creates a schema earlier in the path. These functions are the
   * privilege boundary the whole policy set rests on.
   */
  it("pins search_path on every SECURITY DEFINER function", async () => {
    const { rows } = await db.sql(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and p.prosecdef = true
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
           where cfg like 'search_path=%'
         )
       order by p.proname`,
    );
    expect(rows.map((r) => (r as { proname: string }).proname)).toEqual([]);
  });

  it("keeps the authorization helpers out of the API schema", async () => {
    const { rows } = await db.sql(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
           'can_access_student', 'is_own_student_record',
           'is_workspace_owner', 'is_workspace_member', 'is_workspace_staff'
         )`,
    );
    expect(rows).toEqual([]);
  });
});
