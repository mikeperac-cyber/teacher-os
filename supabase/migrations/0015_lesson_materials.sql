-- Lesson ←→ Material links.
--
-- Nothing attached a material to a lesson before this — the prep checklist
-- reported `lesson_plans.blocks` length as "Materials attached" (see
-- CURRENT_STATE.md), which was wrong twice over. This join table makes the
-- claim true.
--
-- Two link tables: lesson_materials and assignment_materials. Sharing a specific
-- material with a learner stays narrow — no workspace-wide grant to the
-- `materials` table is needed for a student to see a linked file; the link
-- itself grants access via the lesson or assignment they already can see.

-- ---------------------------------------------------------------------------
-- lesson_materials
-- ---------------------------------------------------------------------------

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lesson_id, material_id)
);

create index lesson_materials_lesson_idx on public.lesson_materials (lesson_id);
create index lesson_materials_material_idx on public.lesson_materials (material_id);

alter table public.lesson_materials enable row level security;

-- ---------------------------------------------------------------------------
-- assignment_materials
-- ---------------------------------------------------------------------------

create table public.assignment_materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  assignment_id uuid not null references public.homework_assignments (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (assignment_id, material_id)
);

create index assignment_materials_assignment_idx on public.assignment_materials (assignment_id);
create index assignment_materials_material_idx on public.assignment_materials (material_id);

alter table public.assignment_materials enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: lesson_materials
-- ---------------------------------------------------------------------------

create policy "staff may read lesson materials for students they can access"
  on public.lesson_materials for select
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_materials.lesson_id
        and private.can_access_student(l.student_id)
    )
  );

-- Students may see materials linked to their own lessons.
create policy "a student may read materials linked to their own lessons"
  on public.lesson_materials for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_materials.lesson_id
        and private.is_own_student_record(l.student_id)
    )
  );

create policy "staff may link materials to lessons they can access"
  on public.lesson_materials for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and added_by = (select auth.uid())
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and private.can_access_student(l.student_id)
    )
    and exists (
      select 1 from public.materials m
      where m.id = material_id
        and m.workspace_id = lesson_materials.workspace_id
    )
  );

create policy "staff may unlink materials from lessons they can access"
  on public.lesson_materials for delete
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_materials.lesson_id
        and private.can_access_student(l.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: assignment_materials
-- ---------------------------------------------------------------------------

create policy "staff may read assignment materials for students they can access"
  on public.assignment_materials for select
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and exists (
      select 1 from public.homework_assignments a
      where a.id = assignment_materials.assignment_id
        and private.can_access_student(a.student_id)
    )
  );

create policy "a student may read materials linked to their own assignments"
  on public.assignment_materials for select
  to authenticated
  using (
    exists (
      select 1 from public.homework_assignments a
      where a.id = assignment_materials.assignment_id
        and private.is_own_student_record(a.student_id)
    )
  );

create policy "staff may link materials to assignments they can access"
  on public.assignment_materials for insert
  to authenticated
  with check (
    private.is_workspace_staff(workspace_id)
    and added_by = (select auth.uid())
    and exists (
      select 1 from public.homework_assignments a
      where a.id = assignment_id
        and private.can_access_student(a.student_id)
    )
    and exists (
      select 1 from public.materials m
      where m.id = material_id
        and m.workspace_id = assignment_materials.workspace_id
    )
  );

create policy "staff may unlink materials from assignments they can access"
  on public.assignment_materials for delete
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    and exists (
      select 1 from public.homework_assignments a
      where a.id = assignment_materials.assignment_id
        and private.can_access_student(a.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Material file access via links
-- ---------------------------------------------------------------------------
-- A student who can see a lesson or assignment that has a material linked
-- should be able to read the material record itself and its storage object.
-- Rather than broadening the `materials` table to workspace-wide student reads,
-- grant it through the link.

create policy "a student may read materials linked to their lessons or assignments"
  on public.materials for select
  to authenticated
  using (
    private.is_workspace_staff(workspace_id)
    or exists (
      select 1 from public.lesson_materials lm
      join public.lessons l on l.id = lm.lesson_id
      where lm.material_id = materials.id
        and private.is_own_student_record(l.student_id)
    )
    or exists (
      select 1 from public.assignment_materials am
      join public.homework_assignments a on a.id = am.assignment_id
      where am.material_id = materials.id
        and private.is_own_student_record(a.student_id)
    )
  );

-- Storage: students may read material files linked to their lessons/assignments.
-- The storage policy derives from the object path {workspace_id}/{material_id}/{file},
-- so we check the material_id segment.
create policy "a student may read linked material files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.materials m
      where m.id::text = (storage.foldername(name))[2]
        and (
          exists (
            select 1 from public.lesson_materials lm
            join public.lessons l on l.id = lm.lesson_id
            where lm.material_id = m.id
              and private.is_own_student_record(l.student_id)
          )
          or exists (
            select 1 from public.assignment_materials am
            join public.homework_assignments a on a.id = am.assignment_id
            where am.material_id = m.id
              and private.is_own_student_record(a.student_id)
          )
        )
    )
  );
