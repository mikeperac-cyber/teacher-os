-- Homework: assignment, submission, feedback.
--
-- This is the only place a student writes anything, so it carries the two
-- policies most worth getting right:
--
--   1. A student may edit their own submission only while it is a draft, and
--      may move it no further than 'submitted'. Without the WITH CHECK below, a
--      student could mark their own homework 'returned'.
--   2. A student sees feedback only once it is released. Without that gate they
--      would watch marking happen in real time, including a teacher's first
--      harsh draft.

-- ---------------------------------------------------------------------------
-- homework_assignments
-- ---------------------------------------------------------------------------

create table public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  track public.track not null,

  -- The lesson this work follows from, and the one it must be returned before.
  -- `blocks_lesson_id` is what lets the dashboard rank an item as a blocker.
  lesson_id uuid references public.lessons (id) on delete set null,
  blocks_lesson_id uuid references public.lessons (id) on delete set null,

  title text not null,
  instructions text,
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),

  assigned_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homework_assignments_student_idx
  on public.homework_assignments (student_id, due_at);
create index homework_assignments_workspace_idx
  on public.homework_assignments (workspace_id, track, due_at);

create trigger set_updated_at
  before update on public.homework_assignments
  for each row execute function private.set_updated_at();

alter table public.homework_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- homework_submissions
-- ---------------------------------------------------------------------------

create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  assignment_id uuid not null references public.homework_assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  status public.submission_status not null default 'draft',
  body text,

  -- Set by trigger, never by the client, so a submission time cannot be faked.
  submitted_at timestamptz,
  returned_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (assignment_id)
);

create index homework_submissions_student_idx
  on public.homework_submissions (student_id, status);
create index homework_submissions_workspace_status_idx
  on public.homework_submissions (workspace_id, status);

create trigger set_updated_at
  before update on public.homework_submissions
  for each row execute function private.set_updated_at();

-- Timestamps are derived from status transitions rather than trusted from the
-- caller. A student controls `status`; they must not control when the record
-- claims it happened.
create or replace function private.stamp_submission_transitions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    new.submitted_at = now();
  end if;

  if new.status = 'returned'
     and (tg_op = 'INSERT' or old.status is distinct from 'returned') then
    new.returned_at = now();
  end if;

  return new;
end;
$$;

create trigger stamp_submission_transitions
  before insert or update on public.homework_submissions
  for each row execute function private.stamp_submission_transitions();

alter table public.homework_submissions enable row level security;

-- ---------------------------------------------------------------------------
-- homework_feedback
-- ---------------------------------------------------------------------------

create table public.homework_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  submission_id uuid not null references public.homework_submissions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,

  -- Null means "still being written". The student sees nothing until this is
  -- set, which is what makes marking safe to do incrementally.
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (submission_id)
);

comment on column public.homework_feedback.released_at is
  'Null while the teacher is still drafting. The student RLS policy requires this to be set.';

create index homework_feedback_student_idx on public.homework_feedback (student_id);

create trigger set_updated_at
  before update on public.homework_feedback
  for each row execute function private.set_updated_at();

alter table public.homework_feedback enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: homework_assignments
-- ---------------------------------------------------------------------------

create policy "staff may read assignments for students they can access"
  on public.homework_assignments for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "a student may read their own assignments"
  on public.homework_assignments for select
  to authenticated
  using (private.is_own_student_record(student_id));

create policy "staff may assign homework to students they can access"
  on public.homework_assignments for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and assigned_by = (select auth.uid())
  );

create policy "staff may update assignments for students they can access"
  on public.homework_assignments for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete assignments for students they can access"
  on public.homework_assignments for delete
  to authenticated
  using (private.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Policies: homework_submissions
-- ---------------------------------------------------------------------------

create policy "staff may read submissions for students they can access"
  on public.homework_submissions for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "a student may read their own submissions"
  on public.homework_submissions for select
  to authenticated
  using (private.is_own_student_record(student_id));

-- A student starts their own work. `status` is constrained so a submission
-- cannot be created already marked.
create policy "a student may start their own submission"
  on public.homework_submissions for insert
  to authenticated
  with check (
    private.is_own_student_record(student_id)
    and status in ('draft', 'submitted')
  );

-- THE IMPORTANT ONE.
--
-- USING gates which rows may be edited: only the student's own, and only while
-- still a draft. Once submitted, the row leaves their reach entirely.
--
-- WITH CHECK gates what the row may become: still theirs, and no further along
-- than 'submitted'. Without it a student could set 'returned' or 'checking' and
-- mark their own homework complete.
create policy "a student may edit their own draft until they submit it"
  on public.homework_submissions for update
  to authenticated
  using (
    private.is_own_student_record(student_id)
    and status = 'draft'
  )
  with check (
    private.is_own_student_record(student_id)
    and status in ('draft', 'submitted')
  );

create policy "staff may update submissions for students they can access"
  on public.homework_submissions for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

-- Students may not delete submitted work; staff clean up.
create policy "staff may delete submissions for students they can access"
  on public.homework_submissions for delete
  to authenticated
  using (private.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Policies: homework_feedback
-- ---------------------------------------------------------------------------

create policy "staff may read feedback for students they can access"
  on public.homework_feedback for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "a student may read their own feedback once released"
  on public.homework_feedback for select
  to authenticated
  using (
    released_at is not null
    and private.is_own_student_record(student_id)
  );

create policy "staff may write feedback for students they can access"
  on public.homework_feedback for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and author_id = (select auth.uid())
  );

create policy "staff may update feedback for students they can access"
  on public.homework_feedback for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete feedback for students they can access"
  on public.homework_feedback for delete
  to authenticated
  using (private.can_access_student(student_id));
