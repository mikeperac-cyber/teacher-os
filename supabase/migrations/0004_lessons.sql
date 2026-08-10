-- Lessons, preparation and post-class notes.
--
-- The access rule worth noticing: a student can see that a lesson exists, but
-- not the teacher's plan for it. Preparation is working material — half-formed
-- objectives, notes about what the learner is struggling with — and exposing it
-- would change how teachers write it.

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  track public.track not null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.lesson_status not null default 'scheduled',

  title text,
  attended boolean,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lessons_end_after_start check (ends_at > starts_at)
);

create index lessons_student_starts_idx on public.lessons (student_id, starts_at desc);
create index lessons_workspace_starts_idx on public.lessons (workspace_id, starts_at desc);
-- Serves the dashboard's "next lesson for this track" lookup.
create index lessons_track_starts_idx on public.lessons (workspace_id, track, starts_at)
  where status = 'scheduled';

create trigger set_updated_at
  before update on public.lessons
  for each row execute function private.set_updated_at();

alter table public.lessons enable row level security;

-- ---------------------------------------------------------------------------
-- lesson_plans
-- ---------------------------------------------------------------------------

create table public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  track public.track not null,

  -- ESL: the communicative outcome. IELTS: the band objective.
  -- One column, but its meaning is track-dependent, which is why `track` is
  -- carried here rather than joined for.
  objective text,

  -- ESL: language focus. IELTS: skill or task type.
  focus text,

  teacher_note text,

  -- Timed activity blocks: [{ minutes_from, minutes_to, title, detail }, …].
  -- Genuinely free-form and never reported on, so jsonb is appropriate.
  blocks jsonb not null default '[]'::jsonb,

  marked_ready_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (lesson_id)
);

comment on column public.lesson_plans.objective is
  'ESL: the communicative/CEFR outcome. IELTS: the band objective or rubric gap. Never a shared generic "goal".';

create index lesson_plans_student_idx on public.lesson_plans (student_id);

create trigger set_updated_at
  before update on public.lesson_plans
  for each row execute function private.set_updated_at();

alter table public.lesson_plans enable row level security;

-- ---------------------------------------------------------------------------
-- lesson_notes
-- ---------------------------------------------------------------------------

create table public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,

  -- Notes are private to staff unless the teacher deliberately shares them.
  -- Defaulting to false matters: a teacher writing candidly after a difficult
  -- lesson should never discover it was visible to the learner.
  shared_with_student boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_notes_lesson_idx on public.lesson_notes (lesson_id);
create index lesson_notes_student_idx on public.lesson_notes (student_id, created_at desc);

create trigger set_updated_at
  before update on public.lesson_notes
  for each row execute function private.set_updated_at();

alter table public.lesson_notes enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: lessons
-- ---------------------------------------------------------------------------

create policy "staff may read lessons for students they can access"
  on public.lessons for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "a student may read their own lessons"
  on public.lessons for select
  to authenticated
  using (private.is_own_student_record(student_id));

create policy "staff may schedule lessons for students they can access"
  on public.lessons for insert
  to authenticated
  with check (private.can_access_student(student_id));

create policy "staff may update lessons for students they can access"
  on public.lessons for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete lessons for students they can access"
  on public.lessons for delete
  to authenticated
  using (private.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Policies: lesson_plans
-- ---------------------------------------------------------------------------
-- Staff only. There is deliberately no student policy of any kind here.

create policy "staff may read plans for students they can access"
  on public.lesson_plans for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "staff may create plans for students they can access"
  on public.lesson_plans for insert
  to authenticated
  with check (private.can_access_student(student_id));

create policy "staff may update plans for students they can access"
  on public.lesson_plans for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete plans for students they can access"
  on public.lesson_plans for delete
  to authenticated
  using (private.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Policies: lesson_notes
-- ---------------------------------------------------------------------------

create policy "staff may read notes for students they can access"
  on public.lesson_notes for select
  to authenticated
  using (private.can_access_student(student_id));

create policy "a student may read notes shared with them"
  on public.lesson_notes for select
  to authenticated
  using (
    shared_with_student
    and private.is_own_student_record(student_id)
  );

create policy "staff may write notes for students they can access"
  on public.lesson_notes for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and author_id = (select auth.uid())
  );

create policy "an author may edit their own note"
  on public.lesson_notes for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and private.can_access_student(student_id)
  )
  with check (
    author_id = (select auth.uid())
    and private.can_access_student(student_id)
  );

create policy "an author may delete their own note"
  on public.lesson_notes for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    and private.can_access_student(student_id)
  );
