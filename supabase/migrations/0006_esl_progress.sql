-- ESL progress: CEFR mastery and independent use.
--
-- Kept entirely separate from IELTS band tracking (CLAUDE.md rule 5). A CEFR
-- mastery figure is a 0–100 percentage describing how reliably a learner can
-- use a language system. An IELTS band is a 0–9 examiner judgement against
-- fixed descriptors. They are not convertible, and a shared "score" column
-- would silently destroy the meaning of both.
--
-- Every reportable field here is a typed column, not jsonb.

-- ---------------------------------------------------------------------------
-- esl_student_profiles
-- ---------------------------------------------------------------------------

create table public.esl_student_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  current_cefr text check (current_cefr in ('A1','A2','B1','B2','C1','C2')),
  target_cefr text check (target_cefr in ('A1','A2','B1','B2','C1','C2')),

  course_name text,
  age_group text check (age_group in ('young-learner', 'teen', 'adult')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (student_id)
);

create trigger set_updated_at
  before update on public.esl_student_profiles
  for each row execute function private.set_updated_at();

alter table public.esl_student_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- esl_progress_entries
-- ---------------------------------------------------------------------------

-- One row per recorded assessment point. The dashboard's "mastery is flat"
-- rule compares the two most recent rows for a learner.
create table public.esl_progress_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,

  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id) on delete restrict,

  -- Percentages, 0–100. One typed column per skill: these are reported on.
  grammar smallint check (grammar between 0 and 100),
  vocabulary smallint check (vocabulary between 0 and 100),
  speaking smallint check (speaking between 0 and 100),
  listening smallint check (listening between 0 and 100),
  reading smallint check (reading between 0 and 100),
  confidence smallint check (confidence between 0 and 100),
  overall smallint check (overall between 0 and 100),

  note text,

  -- Withheld from the learner until the teacher is satisfied with it, matching
  -- how homework feedback is handled.
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index esl_progress_student_idx
  on public.esl_progress_entries (student_id, recorded_at desc);

create trigger set_updated_at
  before update on public.esl_progress_entries
  for each row execute function private.set_updated_at();

alter table public.esl_progress_entries enable row level security;

-- ---------------------------------------------------------------------------
-- language_outcomes
-- ---------------------------------------------------------------------------

-- The core ESL diagnostic, and the one with no IELTS equivalent: the gap
-- between what a learner recognises and what they produce unprompted.
create table public.language_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  skill text not null,
  focus text,

  recognition smallint check (recognition between 0 and 100),
  controlled smallint check (controlled between 0 and 100),
  independent smallint check (independent between 0 and 100),

  review_due_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.language_outcomes is
  'Recognition / controlled use / independent use per language system. The recognition-to-independent gap is what the ESL dashboard surfaces as "what to teach next".';

create index language_outcomes_student_idx on public.language_outcomes (student_id);
create index language_outcomes_review_idx on public.language_outcomes (workspace_id, review_due_at)
  where review_due_at is not null;

create trigger set_updated_at
  before update on public.language_outcomes
  for each row execute function private.set_updated_at();

alter table public.language_outcomes enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create policy "staff may read ESL profiles for students they can access"
  on public.esl_student_profiles for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own ESL profile"
  on public.esl_student_profiles for select
  to authenticated using (private.is_own_student_record(student_id));

create policy "staff may create ESL profiles"
  on public.esl_student_profiles for insert
  to authenticated with check (private.can_access_student(student_id));

create policy "staff may update ESL profiles"
  on public.esl_student_profiles for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete ESL profiles"
  on public.esl_student_profiles for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read ESL progress for students they can access"
  on public.esl_progress_entries for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released ESL progress"
  on public.esl_progress_entries for select
  to authenticated
  using (
    released_at is not null
    and private.is_own_student_record(student_id)
  );

create policy "staff may record ESL progress"
  on public.esl_progress_entries for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and recorded_by = (select auth.uid())
  );

create policy "staff may update ESL progress"
  on public.esl_progress_entries for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete ESL progress"
  on public.esl_progress_entries for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read language outcomes"
  on public.language_outcomes for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own language outcomes"
  on public.language_outcomes for select
  to authenticated using (private.is_own_student_record(student_id));

create policy "staff may create language outcomes"
  on public.language_outcomes for insert
  to authenticated with check (private.can_access_student(student_id));

create policy "staff may update language outcomes"
  on public.language_outcomes for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete language outcomes"
  on public.language_outcomes for delete
  to authenticated using (private.can_access_student(student_id));
