-- Shared operational areas: tasks, goals, projects, calendar, materials, files.
--
-- These serve both tracks (CLAUDE.md rule 3). They are staff surfaces: a
-- student has no access to a teacher's task list, project board or material
-- library. The one exception is a goal that belongs to the student, which they
-- may read.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  detail text,
  category text not null default 'teaching'
    check (category in ('teaching', 'business', 'personal')),
  priority public.task_priority not null default 'medium',

  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  completed_at timestamptz,

  -- Null means the task is not track-specific.
  track public.track,
  student_id uuid references public.students (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_owner_due_idx on public.tasks (owner_id, due_at)
  where completed_at is null;

create trigger set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

alter table public.tasks enable row level security;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  -- Set for a student goal; null for a business or teaching-system goal.
  student_id uuid references public.students (id) on delete cascade,
  track public.track,

  title text not null,
  area text,
  progress smallint not null default 0 check (progress between 0 and 100),
  target_label text,
  metric_label text,

  -- Drives the dashboard's "goal reviews due this week" panel.
  review_due_at date,
  last_reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_review_due_idx on public.goals (workspace_id, review_due_at)
  where review_due_at is not null;
create index goals_student_idx on public.goals (student_id)
  where student_id is not null;

create trigger set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

alter table public.goals enable row level security;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  category text,
  progress smallint not null default 0 check (progress between 0 and 100),
  due_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------

-- Non-lesson blocks: preparation, marking, personal commitments. Lessons live
-- in `lessons` and are not duplicated here.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  kind text not null default 'block'
    check (kind in ('block', 'prep', 'marking', 'personal')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_events_end_after_start check (ends_at > starts_at)
);

create index calendar_events_owner_starts_idx
  on public.calendar_events (owner_id, starts_at);

create trigger set_updated_at
  before update on public.calendar_events
  for each row execute function private.set_updated_at();

alter table public.calendar_events enable row level security;

-- ---------------------------------------------------------------------------
-- day_capacities
-- ---------------------------------------------------------------------------

-- How many lessons the teacher is willing to take on a given day. A stated
-- preference, which is what makes overbooking and empty days detectable rather
-- than merely visible.
create table public.day_capacities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  day date not null,
  capacity smallint not null check (capacity >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (owner_id, day)
);

create trigger set_updated_at
  before update on public.day_capacities
  for each row execute function private.set_updated_at();

alter table public.day_capacities enable row level security;

-- ---------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,

  title text not null,
  kind text,
  skill text,
  level_label text,
  -- Null means the material suits both tracks.
  track public.track,

  storage_path text,
  use_count integer not null default 0 check (use_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index materials_workspace_track_idx on public.materials (workspace_id, track);

create trigger set_updated_at
  before update on public.materials
  for each row execute function private.set_updated_at();

alter table public.materials enable row level security;

-- ---------------------------------------------------------------------------
-- files
-- ---------------------------------------------------------------------------

-- Metadata for objects in Storage. Access to the bytes is governed separately
-- by the storage policies in 0009; this table governs access to the record.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  bucket_id text not null,
  storage_path text not null,

  -- Set when the file belongs to a learner (a submission, a recording).
  student_id uuid references public.students (id) on delete cascade,
  submission_id uuid references public.homework_submissions (id) on delete cascade,

  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),

  created_at timestamptz not null default now(),

  unique (bucket_id, storage_path)
);

create index files_student_idx on public.files (student_id) where student_id is not null;

alter table public.files enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
--
-- Personal working surfaces (tasks, calendar, capacity) belong to the member
-- who created them. An owner does not read a teacher's private task list —
-- owning the workspace is not the same as owning someone's day.

create policy "a member may read their own tasks"
  on public.tasks for select
  to authenticated using (owner_id = (select auth.uid()));

create policy "a member may create their own tasks"
  on public.tasks for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.is_workspace_member(workspace_id)
  );

create policy "a member may update their own tasks"
  on public.tasks for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "a member may delete their own tasks"
  on public.tasks for delete
  to authenticated using (owner_id = (select auth.uid()));

create policy "a member may read their own calendar events"
  on public.calendar_events for select
  to authenticated using (owner_id = (select auth.uid()));

create policy "a member may create their own calendar events"
  on public.calendar_events for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.is_workspace_member(workspace_id)
  );

create policy "a member may update their own calendar events"
  on public.calendar_events for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "a member may delete their own calendar events"
  on public.calendar_events for delete
  to authenticated using (owner_id = (select auth.uid()));

create policy "a member may read their own capacity"
  on public.day_capacities for select
  to authenticated using (owner_id = (select auth.uid()));

create policy "a member may set their own capacity"
  on public.day_capacities for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.is_workspace_member(workspace_id)
  );

create policy "a member may change their own capacity"
  on public.day_capacities for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "a member may clear their own capacity"
  on public.day_capacities for delete
  to authenticated using (owner_id = (select auth.uid()));

-- Goals are shared staff context, and a student may read their own.

create policy "staff may read goals in their workspace"
  on public.goals for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "a student may read their own goals"
  on public.goals for select
  to authenticated
  using (
    student_id is not null
    and private.is_own_student_record(student_id)
  );

create policy "staff may create goals"
  on public.goals for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and owner_id = (select auth.uid())
  );

create policy "staff may update goals in their workspace"
  on public.goals for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "an owner may delete any goal, a teacher only their own"
  on public.goals for delete
  to authenticated
  using (
    private.is_workspace_owner(workspace_id)
    or owner_id = (select auth.uid())
  );

-- Projects and materials are shared staff resources.

create policy "staff may read projects"
  on public.projects for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "staff may create projects"
  on public.projects for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and owner_id = (select auth.uid())
  );

create policy "staff may update projects"
  on public.projects for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "an owner may delete any project, a teacher only their own"
  on public.projects for delete
  to authenticated
  using (
    private.is_workspace_owner(workspace_id)
    or owner_id = (select auth.uid())
  );

create policy "staff may read materials"
  on public.materials for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "staff may add materials"
  on public.materials for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and created_by = (select auth.uid())
  );

create policy "staff may update materials"
  on public.materials for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "an owner may delete any material, a teacher only their own"
  on public.materials for delete
  to authenticated
  using (
    private.is_workspace_owner(workspace_id)
    or created_by = (select auth.uid())
  );

-- NOTE: students currently have no read access to `materials`. Sharing a
-- specific material with a learner needs an explicit link table
-- (material_id, lesson_id or assignment_id) so the grant stays narrow. Deferred
-- rather than approximated with a workspace-wide grant.

create policy "staff may read file records for students they can access"
  on public.files for select
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and (student_id is null or private.can_access_student(student_id))
  );

create policy "a student may read their own file records"
  on public.files for select
  to authenticated
  using (
    student_id is not null
    and private.is_own_student_record(student_id)
  );

create policy "a member may record a file they uploaded"
  on public.files for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.is_workspace_member(workspace_id)
    and (
      student_id is null
      or private.can_access_student(student_id)
      or private.is_own_student_record(student_id)
    )
  );

create policy "staff may delete file records"
  on public.files for delete
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and (student_id is null or private.can_access_student(student_id))
  );
