-- Assessments with track-specific criteria.
--
-- The "record an assessment" quick action had no form because it needs a set of
-- criteria to score against and those differ per track (CURRENT_STATE.md). This
-- provides them without merging ESL and IELTS into a generic score (CLAUDE.md 5).
--
-- Two layers:
--   1. rubric_templates + rubric_criteria — the reusable scoring shape per
--      track (e.g. IELTS Writing 4 criteria, ESL CEFR 6 skills, or a custom
--      rubric a teacher defines).
--   2. assessments + assessment_scores — a scheduled or scored instance for one
--      learner, with one row per criterion.
--
-- ESL and IELTS are kept separate by `track` on the template and on the
-- assessment itself. A view or query that unifies them into one "score" would
-- be a product regression.

-- ---------------------------------------------------------------------------
-- rubric_templates
-- ---------------------------------------------------------------------------

create table public.rubric_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  track public.track not null,
  title text not null,
  description text,
  kind text not null default 'custom'
    check (kind in ('esl_progress_check', 'ielts_writing', 'ielts_speaking', 'ielts_mock', 'custom')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rubric_templates_workspace_track_idx
  on public.rubric_templates (workspace_id, track);

create trigger set_updated_at
  before update on public.rubric_templates
  for each row execute function private.set_updated_at();

alter table public.rubric_templates enable row level security;

-- ---------------------------------------------------------------------------
-- rubric_criteria
-- ---------------------------------------------------------------------------

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.rubric_templates (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  label text not null,
  description text,
  sort_order smallint not null default 0,
  -- For ESL criteria this is a 0-100 percentage; for IELTS it maps to band_score
  -- via assessment_scores. max_score is informational (e.g. 9 for bands, 100 for
  -- mastery) and not enforced beyond being positive.
  max_score numeric check (max_score is null or max_score > 0),
  created_at timestamptz not null default now()
);

create index rubric_criteria_template_idx
  on public.rubric_criteria (template_id, sort_order);

alter table public.rubric_criteria enable row level security;

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  track public.track not null,
  template_id uuid references public.rubric_templates (id) on delete set null,
  title text not null,
  kind text not null default 'progress_check'
    check (kind in ('progress_check', 'mock', 'sectional', 'assignment', 'custom')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'submitted', 'scored', 'returned')),
  due_at timestamptz,
  blocks_lesson_id uuid references public.lessons (id) on delete set null,
  scheduled_by uuid not null references public.profiles (id) on delete restrict,
  notes text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessments_student_idx on public.assessments (student_id, status);
create index assessments_workspace_track_idx on public.assessments (workspace_id, track, status);
create index assessments_due_idx on public.assessments (workspace_id, due_at) where due_at is not null;

create trigger set_updated_at
  before update on public.assessments
  for each row execute function private.set_updated_at();

alter table public.assessments enable row level security;

-- ---------------------------------------------------------------------------
-- assessment_scores
-- ---------------------------------------------------------------------------

create table public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria (id) on delete cascade,
  -- For ESL: 0-100. For IELTS: 0-9 half-band stored as numeric but validated as band_score where used.
  score numeric check (score >= 0),
  band public.band_score,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, criterion_id)
);

create index assessment_scores_assessment_idx on public.assessment_scores (assessment_id);

create trigger set_updated_at
  before update on public.assessment_scores
  for each row execute function private.set_updated_at();

alter table public.assessment_scores enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- rubric_templates: staff only. Students have no read access — the template
-- shape is not needed to see their own scored assessment.
create policy "staff may read rubric templates in their workspace"
  on public.rubric_templates for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "staff may create rubric templates"
  on public.rubric_templates for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and created_by = (select auth.uid())
  );

create policy "staff may update rubric templates"
  on public.rubric_templates for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "an owner may delete any template, a teacher only their own"
  on public.rubric_templates for delete
  to authenticated
  using (
    private.is_workspace_owner(workspace_id)
    or created_by = (select auth.uid())
  );

-- rubric_criteria: follows its template's workspace
create policy "staff may read rubric criteria"
  on public.rubric_criteria for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "staff may create rubric criteria"
  on public.rubric_criteria for insert
  to authenticated
  with check (private.is_workspace_staff(workspace_id));

create policy "staff may update rubric criteria"
  on public.rubric_criteria for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "staff may delete rubric criteria"
  on public.rubric_criteria for delete
  to authenticated using (private.is_workspace_staff(workspace_id));

-- assessments: staff act on students they can access; students read only released
create policy "staff may read assessments for students they can access"
  on public.assessments for select
  to authenticated using (private.can_access_student(student_id));

create policy "a student may read their own released assessments"
  on public.assessments for select
  to authenticated
  using (
    released_at is not null
    and private.is_own_student_record(student_id)
  );

create policy "staff may create assessments for students they can access"
  on public.assessments for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    and scheduled_by = (select auth.uid())
  );

create policy "staff may update assessments for students they can access"
  on public.assessments for update
  to authenticated
  using (private.can_access_student(student_id))
  with check (private.can_access_student(student_id));

create policy "staff may delete assessments for students they can access"
  on public.assessments for delete
  to authenticated using (private.can_access_student(student_id));

-- assessment_scores: same boundary as the assessment itself
create policy "staff may read assessment scores for students they can access"
  on public.assessment_scores for select
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and private.can_access_student(a.student_id)
    )
  );

create policy "a student may read their own released assessment scores"
  on public.assessment_scores for select
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and a.released_at is not null
        and private.is_own_student_record(a.student_id)
    )
  );

create policy "staff may create assessment scores for students they can access"
  on public.assessment_scores for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and private.can_access_student(a.student_id)
    )
  );

create policy "staff may update assessment scores for students they can access"
  on public.assessment_scores for update
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and private.can_access_student(a.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and private.can_access_student(a.student_id)
    )
  );

create policy "staff may delete assessment scores for students they can access"
  on public.assessment_scores for delete
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and private.can_access_student(a.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: official IELTS criteria as templates (idempotent)
-- ---------------------------------------------------------------------------

-- This is run as the migration itself, not per workspace, so no seed rows are
-- inserted here. Templates are created per workspace on demand via the
-- `ensure_default_templates` helper or the UI — inserting global rows would
-- break tenancy. The constants in `lib/types/domain.ts` remain the source of
-- truth for the official names.

-- Helper to ensure a workspace has the standard templates. Called by the server
-- action that creates the first assessment, so a teacher never has to seed
-- manually.
create or replace function public.ensure_default_rubric_templates(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template uuid;
begin
  if not private.is_workspace_staff(p_workspace_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- IELTS Writing — 4 official criteria
  if not exists (
    select 1 from public.rubric_templates
    where workspace_id = p_workspace_id and track = 'ielts' and kind = 'ielts_writing'
  ) then
    insert into public.rubric_templates (workspace_id, track, title, kind, description, created_by)
    values (
      p_workspace_id, 'ielts', 'IELTS Writing', 'ielts_writing',
      'Official Writing criteria: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy',
      (select auth.uid())
    ) returning id into v_template;

    insert into public.rubric_criteria (template_id, workspace_id, label, sort_order, max_score)
    values
      (v_template, p_workspace_id, 'Task Achievement / Task Response', 1, 9),
      (v_template, p_workspace_id, 'Coherence and Cohesion', 2, 9),
      (v_template, p_workspace_id, 'Lexical Resource', 3, 9),
      (v_template, p_workspace_id, 'Grammatical Range and Accuracy', 4, 9);
  end if;

  -- IELTS Speaking — 4 official criteria
  if not exists (
    select 1 from public.rubric_templates
    where workspace_id = p_workspace_id and track = 'ielts' and kind = 'ielts_speaking'
  ) then
    insert into public.rubric_templates (workspace_id, track, title, kind, description, created_by)
    values (
      p_workspace_id, 'ielts', 'IELTS Speaking', 'ielts_speaking',
      'Official Speaking criteria: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation',
      (select auth.uid())
    ) returning id into v_template;

    insert into public.rubric_criteria (template_id, workspace_id, label, sort_order, max_score)
    values
      (v_template, p_workspace_id, 'Fluency and Coherence', 1, 9),
      (v_template, p_workspace_id, 'Lexical Resource', 2, 9),
      (v_template, p_workspace_id, 'Grammatical Range and Accuracy', 3, 9),
      (v_template, p_workspace_id, 'Pronunciation', 4, 9);
  end if;

  -- ESL — 6 CEFR skills as a progress check template
  if not exists (
    select 1 from public.rubric_templates
    where workspace_id = p_workspace_id and track = 'esl' and kind = 'esl_progress_check'
  ) then
    insert into public.rubric_templates (workspace_id, track, title, kind, description, created_by)
    values (
      p_workspace_id, 'esl', 'CEFR Progress Check', 'esl_progress_check',
      'CEFR mastery 0-100 for Grammar, Vocabulary, Speaking, Listening, Reading, Confidence',
      (select auth.uid())
    ) returning id into v_template;

    insert into public.rubric_criteria (template_id, workspace_id, label, sort_order, max_score)
    values
      (v_template, p_workspace_id, 'Grammar', 1, 100),
      (v_template, p_workspace_id, 'Vocabulary', 2, 100),
      (v_template, p_workspace_id, 'Speaking', 3, 100),
      (v_template, p_workspace_id, 'Listening', 4, 100),
      (v_template, p_workspace_id, 'Reading', 5, 100),
      (v_template, p_workspace_id, 'Confidence', 6, 100);
  end if;
end;
$$;

grant execute on function public.ensure_default_rubric_templates(uuid) to authenticated;
