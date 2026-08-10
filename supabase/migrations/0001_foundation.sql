-- Foundation: schemas, enumerated types and shared triggers.
--
-- Nothing here is application data. It establishes the vocabulary every later
-- migration uses, and the `private` schema that holds the SECURITY DEFINER
-- helpers the RLS policies depend on.
--
-- Conventions applied throughout this directory:
--
--   * Row Level Security is enabled in the SAME migration that creates a table.
--     There is never a window in which a table exists unprotected.
--   * Policies are written per operation (select / insert / update / delete)
--     rather than as one FOR ALL policy, so each grant is readable on its own.
--   * `auth.uid()` is always wrapped as `(select auth.uid())`. Postgres then
--     evaluates it once per statement instead of once per row.
--   * Every business table carries `workspace_id`. Every student-owned table
--     also carries `student_id`.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- Case-insensitive text, for email addresses. Installed into `extensions`
-- rather than `public`, per Supabase convention.
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------

-- Helper functions live here, not in `public`, so they are never exposed
-- through PostgREST as callable RPC endpoints.
create schema if not exists private;

revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

-- Workspace roles. A guardian role is anticipated but deliberately out of scope
-- for the first release (CLAUDE.md, "Required roles").
create type public.workspace_role as enum ('owner', 'teacher', 'student');

-- The two teaching tracks. These are separate tracking systems, not a filter on
-- one shared model (CLAUDE.md rules 1, 2 and 5).
create type public.track as enum ('esl', 'ielts');

create type public.lesson_status as enum (
  'scheduled',
  'delivered',
  'cancelled',
  'rescheduled'
);

-- Mirrors the four columns of the homework board.
-- 'draft' exists so a student can start work without submitting it.
create type public.submission_status as enum (
  'draft',
  'submitted',
  'checking',
  'returned'
);

create type public.task_priority as enum ('high', 'medium', 'low');

-- The four IELTS skills, in official reporting order.
create type public.ielts_skill as enum (
  'listening',
  'reading',
  'writing',
  'speaking'
);

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

-- `search_path = ''` forces every reference inside the function to be schema
-- qualified. Without it, a caller could prepend a schema of their own and
-- shadow the objects this function resolves.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function private.set_updated_at is
  'Maintains updated_at. Attach with: create trigger set_updated_at before update on <table> for each row execute function private.set_updated_at();';
