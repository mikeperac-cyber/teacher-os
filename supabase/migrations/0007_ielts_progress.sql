-- IELTS Academic progress: band scores against official criteria.
--
-- Separate from ESL progress by design (CLAUDE.md rule 5). Do not add a view or
-- table that unifies the two into a single "score".
--
-- Bands are numeric(2,1) constrained to the official 0–9 scale in half-band
-- steps. Storing them as a percentage, or allowing 6.3, would make every
-- reported figure subtly wrong.

-- A band is valid when it is between 0 and 9 and lands on a whole or half step.
create domain public.band_score as numeric(2,1)
  check (
    value >= 0
    and value <= 9
    and (value * 2) = trunc(value * 2)
  );

comment on domain public.band_score is
  'IELTS band: 0–9 in half-band steps. Rejects 6.3 and similar, which no examiner can award.';

-- ---------------------------------------------------------------------------
-- ielts_student_profiles
-- ---------------------------------------------------------------------------

create table public.ielts_student_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  target_band public.band_score,
  -- Drives the dashboard's test-approaching risk rule.
  test_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (student_id)
);

create index ielts_profiles_test_date_idx
  on public.ielts_student_profiles (workspace_id, test_date)
  where test_date is not null;

create trigger set_updated_at
  before update on public.ielts_student_profiles
  for each row execute function private.set_updated_at();

alter table public.ielts_student_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- ielts_mock_tests
-- ---------------------------------------------------------------------------

create table public.ielts_mock_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,

  taken_at timestamptz not null default now(),
  kind text not null default 'full' check (kind in ('full', 'sectional')),

  overall_band public.band_score,
  note text,

  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ielts_mocks_student_idx
  on public.ielts_mock_tests (student_id, taken_at desc);

create trigger set_updated_at
  before update on public.ielts_mock_tests
  for each row execute function private.set_updated_at();

alter table public.ielts_mock_tests enable row level security;

-- ---------------------------------------------------------------------------
-- ielts_skill_scores
-- ---------------------------------------------------------------------------

create table public.ielts_skill_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  mock_test_id uuid references public.ielts_mock_tests (id) on delete cascade,

  skill public.ielts_skill not null,
  band public.band_score not null,

  -- Raw marks, where the section produces them (Listening and Reading).
  raw_correct smallint check (raw_correct >= 0),
  raw_total smallint check (raw_total > 0),

  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint raw_correct_within_total
    check (raw_correct is null or raw_total is null or raw_correct <= raw_total)
);

create index ielts_skill_scores_student_idx
  on public.ielts_skill_scores (student_id, skill, recorded_at desc);

create trigger set_updated_at
  before update on public.ielts_skill_scores
  for each row execute function private.set_updated_at();

alter table public.ielts_skill_scores enable row level security;

-- ---------------------------------------------------------------------------
-- ielts_writing_scores
-- ---------------------------------------------------------------------------

-- The four official Writing criteria, one typed column each. Not a jsonb blob:
-- the Writing Tracker reports on each criterion independently.
create table public.ielts_writing_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  submission_id uuid references public.homework_submissions (id) on delete set null,

  task text not null check (task in ('task-1', 'task-2')),

  task_achievement public.band_score,
  coherence_cohesion public.band_score,
  lexical_resource public.band_score,
  grammatical_range public.band_score,
  overall public.band_score,

  word_count integer check (word_count is null or word_count >= 0),
  examiner_note text,

  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ielts_writing_student_idx
  on public.ielts_writing_scores (student_id, recorded_at desc);

create trigger set_updated_at
  before update on public.ielts_writing_scores
  for each row execute function private.set_updated_at();

alter table public.ielts_writing_scores enable row level security;

-- ---------------------------------------------------------------------------
-- ielts_speaking_scores
-- ---------------------------------------------------------------------------

create table public.ielts_speaking_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  submission_id uuid references public.homework_submissions (id) on delete set null,

  weakest_part text check (weakest_part in ('part-1', 'part-2', 'part-3')),

  fluency_coherence public.band_score,
  lexical_resource public.band_score,
  grammatical_range public.band_score,
  pronunciation public.band_score,
  overall public.band_score,

  recording_seconds integer check (recording_seconds is null or recording_seconds > 0),
  examiner_note text,

  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ielts_speaking_student_idx
  on public.ielts_speaking_scores (student_id, recorded_at desc);

create trigger set_updated_at
  before update on public.ielts_speaking_scores
  for each row execute function private.set_updated_at();

alter table public.ielts_speaking_scores enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
--
-- Uniform shape across all five tables: staff act on students they can access;
-- a student reads their own rows, and only after release. Written out per table
-- rather than generated, so each grant is greppable.

create policy "staff may read IELTS profiles"
  on public.ielts_student_profiles for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own IELTS profile"
  on public.ielts_student_profiles for select
  to authenticated using (private.is_own_student_record(student_id));

create policy "staff may create IELTS profiles"
  on public.ielts_student_profiles for insert
  to authenticated with check (private.can_access_student(student_id));

create policy "staff may update IELTS profiles"
  on public.ielts_student_profiles for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete IELTS profiles"
  on public.ielts_student_profiles for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read mock tests"
  on public.ielts_mock_tests for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released mock tests"
  on public.ielts_mock_tests for select
  to authenticated
  using (released_at is not null and private.is_own_student_record(student_id));

create policy "staff may create mock tests"
  on public.ielts_mock_tests for insert
  to authenticated with check (private.can_access_student(student_id));

create policy "staff may update mock tests"
  on public.ielts_mock_tests for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete mock tests"
  on public.ielts_mock_tests for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read skill scores"
  on public.ielts_skill_scores for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released skill scores"
  on public.ielts_skill_scores for select
  to authenticated
  using (released_at is not null and private.is_own_student_record(student_id));

create policy "staff may record skill scores"
  on public.ielts_skill_scores for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and recorded_by = (select auth.uid())
  );

create policy "staff may update skill scores"
  on public.ielts_skill_scores for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete skill scores"
  on public.ielts_skill_scores for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read writing scores"
  on public.ielts_writing_scores for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released writing scores"
  on public.ielts_writing_scores for select
  to authenticated
  using (released_at is not null and private.is_own_student_record(student_id));

create policy "staff may record writing scores"
  on public.ielts_writing_scores for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and recorded_by = (select auth.uid())
  );

create policy "staff may update writing scores"
  on public.ielts_writing_scores for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete writing scores"
  on public.ielts_writing_scores for delete
  to authenticated using (private.can_access_student(student_id));

create policy "staff may read speaking scores"
  on public.ielts_speaking_scores for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released speaking scores"
  on public.ielts_speaking_scores for select
  to authenticated
  using (released_at is not null and private.is_own_student_record(student_id));

create policy "staff may record speaking scores"
  on public.ielts_speaking_scores for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and recorded_by = (select auth.uid())
  );

create policy "staff may update speaking scores"
  on public.ielts_speaking_scores for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete speaking scores"
  on public.ielts_speaking_scores for delete
  to authenticated using (private.can_access_student(student_id));
