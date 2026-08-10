-- Students, their optional logins, and teacher assignment.
--
-- This migration decides who can reach a learner's records at all. Everything
-- in later migrations reduces to `private.can_access_student`.

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- Which tracking system this learner belongs to. Track-specific detail lives
  -- in esl_student_profiles / ielts_student_profiles, never in shared columns.
  track public.track not null,

  full_name text not null,
  preferred_name text,
  email extensions.citext,
  phone text,
  timezone text not null default 'UTC',

  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),

  started_at date not null default current_date,
  notes text,

  -- Teacher-defined metadata only. Anything used in reporting gets a typed
  -- column instead (CLAUDE.md, "Implementation rules").
  custom_fields jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.students.custom_fields is
  'Teacher-defined metadata. Never used for reporting or authorization — reportable fields are typed columns.';

create index students_workspace_id_idx on public.students (workspace_id);
create index students_workspace_track_idx on public.students (workspace_id, track);

create trigger set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

alter table public.students enable row level security;

-- ---------------------------------------------------------------------------
-- student_accounts
-- ---------------------------------------------------------------------------

create table public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- A login maps to at most one learner record, and vice versa.
  unique (student_id),
  unique (user_id, workspace_id)
);

comment on table public.student_accounts is
  'Links a student record to a login. A student record without a row here simply has no portal access yet.';

create index student_accounts_user_id_idx on public.student_accounts (user_id);

alter table public.student_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- teacher_student_assignments
-- ---------------------------------------------------------------------------

create table public.teacher_student_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  teacher_user_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_user_id, student_id)
);

comment on table public.teacher_student_assignments is
  'Which teachers may reach which learners. A teacher with no assignment sees no students, which is the correct default.';

create index tsa_student_id_idx on public.teacher_student_assignments (student_id);
create index tsa_teacher_user_id_idx on public.teacher_student_assignments (teacher_user_id);

alter table public.teacher_student_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- The learner records the current user *is*. Empty for staff.
create or replace function private.current_student_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select sa.student_id
  from public.student_accounts sa
  where sa.user_id = (select auth.uid());
$$;

-- Staff reach over one learner.
--
-- Owners reach every learner in their workspace. Teachers reach only the
-- learners explicitly assigned to them — an unassigned teacher sees nothing,
-- which is what makes the two-teacher isolation test meaningful.
--
-- Deliberately excludes students: a student's access to their own records is
-- expressed separately on each table, and is narrower (read-only for most,
-- release-gated for feedback and scores). Folding both into one helper would
-- make it far too easy to grant a student a staff-shaped permission by
-- accident.
create or replace function private.can_access_student(target_student uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    join public.workspace_members m
      on m.workspace_id = s.workspace_id
     and m.user_id = (select auth.uid())
    where s.id = target_student
      and (
        m.role = 'owner'
        or (
          m.role = 'teacher'
          and exists (
            select 1
            from public.teacher_student_assignments a
            where a.student_id = s.id
              and a.teacher_user_id = (select auth.uid())
          )
        )
      )
  );
$$;

-- True when the current user is the learner in question.
create or replace function private.is_own_student_record(target_student uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_accounts sa
    where sa.student_id = target_student
      and sa.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies: students
-- ---------------------------------------------------------------------------

create policy "staff may read students they can access"
  on public.students for select
  to authenticated
  using (private.can_access_student(id));

create policy "a student may read their own record"
  on public.students for select
  to authenticated
  using (private.is_own_student_record(id));

create policy "owners may create students in their workspace"
  on public.students for insert
  to authenticated
  with check (private.is_workspace_owner(workspace_id));

-- Teachers may edit an assigned learner's record, but the record cannot be
-- moved to another workspace: WITH CHECK re-tests access on the new row.
create policy "staff may update students they can access"
  on public.students for update
  to authenticated
  using (private.can_access_student(id))
  with check (
    private.can_access_student(id)
    and private.is_workspace_member(workspace_id)
  );

-- Deleting a learner destroys their whole history, so it stays with the owner.
create policy "owners may delete students"
  on public.students for delete
  to authenticated
  using (private.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- Policies: student_accounts
-- ---------------------------------------------------------------------------

create policy "a user may see their own student link"
  on public.student_accounts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "staff may see links for students they can access"
  on public.student_accounts for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "owners may link a student to a login"
  on public.student_accounts for insert
  to authenticated
  with check (private.is_workspace_owner(workspace_id));

create policy "owners may unlink a student login"
  on public.student_accounts for delete
  to authenticated
  using (private.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- Policies: teacher_student_assignments
-- ---------------------------------------------------------------------------

create policy "a teacher may see their own assignments"
  on public.teacher_student_assignments for select
  to authenticated
  using (teacher_user_id = (select auth.uid()));

create policy "owners may see every assignment in their workspace"
  on public.teacher_student_assignments for select
  to authenticated
  using (private.is_workspace_owner(workspace_id));

-- Only owners assign. A teacher must not be able to grant themselves access to
-- a learner they were not given.
create policy "owners may assign a teacher to a student"
  on public.teacher_student_assignments for insert
  to authenticated
  with check (private.is_workspace_owner(workspace_id));

create policy "owners may remove an assignment"
  on public.teacher_student_assignments for delete
  to authenticated
  using (private.is_workspace_owner(workspace_id));
