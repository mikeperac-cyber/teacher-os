/**
 * A real Postgres, in-process, for testing Row Level Security.
 *
 * WHY THIS EXISTS
 * ---------------
 * RLS is the authorization boundary for this application. Policies that have
 * only been read, never executed, are an assumption — and the failure mode is
 * silent: a policy with a subtly wrong predicate does not error, it just lets
 * the wrong person read a child's records.
 *
 * PGlite runs genuine Postgres compiled to WASM, so the migrations in
 * `supabase/migrations/` execute exactly as written and the policies are
 * enforced by the same engine that will enforce them in production. No Docker,
 * no cloud project, no credentials.
 *
 * WHAT IS STUBBED
 * ---------------
 * Supabase provides `auth` and `storage` schemas, four roles, and default
 * grants. Those are platform scaffolding, not part of this repository, so the
 * harness recreates the parts the migrations touch:
 *
 *   - roles: anon, authenticated, service_role
 *   - auth.users, auth.uid()
 *   - storage.buckets, storage.objects, storage.foldername()
 *
 * `auth.uid()` reads the same session setting Supabase uses
 * (`request.jwt.claim.sub`), so `asUser()` below reproduces how a request
 * actually arrives at the database.
 *
 * WHAT THIS DOES NOT PROVE
 * ------------------------
 * That Supabase's own grants, GoTrue behaviour and PostgREST exposure match
 * these assumptions. It proves the policies themselves are correct, which is
 * the part this repository owns.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../supabase/migrations/", import.meta.url),
);

/**
 * Platform scaffolding Supabase supplies and the migrations assume.
 * Kept deliberately minimal — only what the migrations actually reference.
 */
const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema if not exists extensions;
  create schema if not exists auth;
  create schema if not exists storage;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema extensions to anon, authenticated, service_role;

  -- Minimal stand-in for Supabase's auth.users.
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  -- The identity of the current request.
  --
  -- Supabase derives this from the verified JWT. Reading the same setting means
  -- a policy tested here is exercised through the same code path it will use in
  -- production.
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  -- Storage scaffolding.
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz not null default now()
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now()
  );

  alter table storage.objects enable row level security;

  -- Splits an object path into segments, as Supabase's helper does.
  create or replace function storage.foldername(name text)
  returns text[]
  language sql
  immutable
  as $$
    select string_to_array(name, '/');
  $$;

  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

/**
 * Grants Supabase applies by default to every table in `public`.
 *
 * Without these the `authenticated` role is denied by table privileges before
 * RLS is ever consulted, and every test would pass for the wrong reason.
 */
const DEFAULT_GRANTS = `
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
`;

/**
 * Whether a scoped block keeps its writes.
 *
 * Rollback is the default because most assertions only read, and discarding
 * keeps each test independent. The workflow suite is the exception: it walks a
 * sequence where each step depends on the last, so it commits.
 */
export type ScopeOptions = { commit?: boolean };

export type TestDb = {
  sql: (query: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  /** Runs a callback as the given user, with RLS enforced. */
  asUser: <T>(
    userId: string,
    fn: (db: TestDb) => Promise<T>,
    options?: ScopeOptions,
  ) => Promise<T>;
  /** Runs a callback with RLS bypassed, for arranging fixtures. */
  asAdmin: <T>(fn: (db: TestDb) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

/** Applies every migration in filename order to a fresh database. */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  for (const file of files) {
    let sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

    // PGlite does not ship the citext contrib module. The column only needs
    // case-insensitive comparison, which a domain over text gives us for the
    // purposes of these tests. Production uses the real extension.
    sql = sql.replace(
      /create extension if not exists citext with schema extensions;/,
      "create domain extensions.citext as text;",
    );

    try {
      await pg.exec(sql);
    } catch (error) {
      throw new Error(
        `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await pg.exec(DEFAULT_GRANTS);

  const sql = async (query: string, params: unknown[] = []) => {
    const result = await pg.query(query, params);
    return { rows: result.rows as unknown[] };
  };

  const db: TestDb = {
    sql,
    asUser: async (userId, fn, options = {}) => {
      // `set local` scopes both the role and the identity to this transaction,
      // so a test cannot leak its identity into the next one.
      await pg.exec("begin");
      let succeeded = false;
      try {
        await pg.query("select set_config('request.jwt.claim.sub', $1, true)", [
          userId,
        ]);
        await pg.exec("set local role authenticated");
        const result = await fn(db);
        succeeded = true;
        return result;
      } finally {
        // Only commit a block that asked for it *and* got through cleanly. A
        // statement that raised has already aborted the transaction, so there
        // is nothing to keep either way.
        await pg.exec(options.commit && succeeded ? "commit" : "rollback");
      }
    },
    asAdmin: async (fn) => fn(db),
    close: async () => {
      await pg.close();
    },
  };

  return db;
}

/** Convenience: a query run as `userId`, returning rows. */
export async function queryAs(
  db: TestDb,
  userId: string,
  query: string,
  params: unknown[] = [],
  options: ScopeOptions = {},
): Promise<unknown[]> {
  return db.asUser(
    userId,
    async (scoped) => {
      const { rows } = await scoped.sql(query, params);
      return rows;
    },
    options,
  );
}

/**
 * A write run as `userId` that is kept.
 *
 * For sequences where each step builds on the last. Reads and denial checks
 * should keep using `queryAs`, which discards.
 */
export async function writeAs(
  db: TestDb,
  userId: string,
  query: string,
  params: unknown[] = [],
): Promise<unknown[]> {
  return queryAs(db, userId, query, params, { commit: true });
}

/**
 * Asserts a statement is refused.
 *
 * RLS refuses reads by returning no rows and refuses writes by raising. Both
 * count as denial, so this normalises them into one boolean.
 */
export async function isDenied(
  db: TestDb,
  userId: string,
  query: string,
  params: unknown[] = [],
): Promise<boolean> {
  try {
    const rows = await queryAs(db, userId, query, params);
    return rows.length === 0;
  } catch {
    return true;
  }
}
