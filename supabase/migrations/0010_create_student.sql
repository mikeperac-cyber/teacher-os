-- Atomic student creation.
--
-- WHY A DATABASE FUNCTION
-- ----------------------
-- Creating a learner writes two rows: the `students` record and the
-- track-specific profile beside it. The Supabase client cannot span a
-- transaction across two calls, so doing it from application code leaves a
-- window where the first insert succeeds and the second fails — an ESL learner
-- with no CEFR profile, or an IELTS candidate with no target band or test date.
-- Half a learner is worse than none, because nothing surfaces it.
--
-- A function body is a single transaction, so both rows land or neither does.
--
-- SECURITY INVOKER is deliberate: this must run with the caller's privileges so
-- Row Level Security still decides whether they may create a student at all.
-- Making it SECURITY DEFINER would hand every authenticated user the ability to
-- create learners in any workspace.

create or replace function public.create_student(
  p_workspace_id uuid,
  p_track public.track,
  p_full_name text,
  p_target text default null,
  p_test_date date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_student_id uuid;
  trimmed_name text := btrim(p_full_name);
  trimmed_target text := nullif(btrim(coalesce(p_target, '')), '');
begin
  if trimmed_name = '' then
    raise exception 'A student needs a name' using errcode = '23514';
  end if;

  insert into public.students (workspace_id, track, full_name)
  values (p_workspace_id, p_track, trimmed_name)
  returning id into new_student_id;

  -- ESL and IELTS profiles are separate tables holding different measurements
  -- (CLAUDE.md rule 5), so the branch is on the track, not on a shared shape.
  if p_track = 'esl' then
    insert into public.esl_student_profiles (workspace_id, student_id, target_cefr)
    values (p_workspace_id, new_student_id, trimmed_target);
  else
    insert into public.ielts_student_profiles
      (workspace_id, student_id, target_band, test_date)
    values (
      p_workspace_id,
      new_student_id,
      -- Cast through the band_score domain so an invalid target is rejected
      -- here rather than silently stored.
      trimmed_target::public.band_score,
      p_test_date
    );
  end if;

  return new_student_id;
end;
$$;

comment on function public.create_student is
  'Creates a student and their track profile atomically. SECURITY INVOKER, so RLS still decides whether the caller may create one.';

grant execute on function public.create_student(uuid, public.track, text, text, date)
  to authenticated;
