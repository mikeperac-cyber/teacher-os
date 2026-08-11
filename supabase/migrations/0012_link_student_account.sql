-- Give a learner access to their own records.
--
-- WHY THIS NEEDS A FUNCTION
-- -------------------------
-- The owner has to name the person somehow, and the only identifier they know
-- is an email address. But an email address is not something the owner can look
-- up: `profiles` is readable only by its owner and by staff sharing a workspace
-- (0002_identity.sql), and someone who has just signed up belongs to no
-- workspace at all. So their profile is invisible to the person who needs to
-- link it.
--
-- Relaxing that policy would make every profile in the system searchable by
-- email to anyone with an account, which is a directory of real people. The
-- narrow fix is a definer function that resolves exactly one address, for
-- exactly one learner, and only when the caller owns that learner's workspace.
--
-- WHY THE LEARNER ALSO BECOMES A WORKSPACE MEMBER
-- -----------------------------------------------
-- Student access to records is expressed through `student_accounts`, not
-- membership, so strictly the row below is not needed to read anything. It is
-- needed for the session to resolve: `getSession` finds a workspace through
-- `workspace_members`, and without a row there a linked student would be shown
-- the "create your workspace" onboarding screen instead of their lessons.
--
-- The role is 'student', and that is safe: every staff grant goes through
-- `private.is_workspace_staff`, which admits only 'owner' and 'teacher'. The
-- handful of policies using the broader `is_workspace_member` all require the
-- row to be the caller's own (their tasks, their calendar, their files).

-- ---------------------------------------------------------------------------
-- link_student_account
-- ---------------------------------------------------------------------------

create or replace function public.link_student_account(
  p_student_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
  v_existing_role public.workspace_role;
begin
  select s.workspace_id into v_workspace_id
  from public.students s
  where s.id = p_student_id;

  if v_workspace_id is null then
    raise exception 'That learner does not exist.'
      using errcode = 'no_data_found';
  end if;

  -- The authorization check. This function is SECURITY DEFINER, so RLS does not
  -- run — the check has to be explicit, and it has to come before anything is
  -- read or written.
  if not private.is_workspace_owner(v_workspace_id) then
    raise exception 'Only the workspace owner may link a learner to a login.'
      using errcode = 'insufficient_privilege';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    -- Deliberately explicit. This is not the sign-in screen, where naming a
    -- missing account would leak which addresses are registered; here the
    -- caller is the workspace owner acting on their own learner, and a vague
    -- failure would leave them with no idea what to do next.
    raise exception 'No account uses that email address yet. Ask them to sign up first, then link them.'
      using errcode = 'no_data_found';
  end if;

  -- A teacher must not also be a student in the same workspace: the two roles
  -- grant different things and the interface renders one shell or the other.
  select m.role into v_existing_role
  from public.workspace_members m
  where m.workspace_id = v_workspace_id
    and m.user_id = v_user_id;

  -- Raised with the default P0001 rather than 'unique_violation'. The
  -- application maps 23505 to a generic "That already exists", which would
  -- throw away the only sentence here that tells the owner what is wrong.
  if v_existing_role is not null and v_existing_role <> 'student' then
    raise exception 'That account is already a % in this workspace.', v_existing_role;
  end if;

  -- The unique constraints say "one login per learner, one learner per login
  -- per workspace". Caught and reworded, because the raw constraint name is not
  -- something a teacher can act on.
  begin
    insert into public.student_accounts (student_id, user_id, workspace_id)
    values (p_student_id, v_user_id, v_workspace_id);
  exception
    when unique_violation then
      raise exception 'That learner already has a login, or that login is already linked to another learner.';
  end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'student')
  on conflict (workspace_id, user_id) do nothing;

  return v_user_id;
end;
$$;

comment on function public.link_student_account is
  'Owner-only. Resolves one email address to a login and gives that login access to exactly one learner record.';

revoke all on function public.link_student_account(uuid, text) from public;
grant execute on function public.link_student_account(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- unlink_student_account
-- ---------------------------------------------------------------------------
--
-- Removes portal access without touching a single teaching record. The learner
-- stops being able to sign in to their own history; the history itself is
-- untouched, which is the behaviour a teacher expects from "revoke access"
-- rather than "delete this person".

create or replace function public.unlink_student_account(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
begin
  select sa.workspace_id, sa.user_id into v_workspace_id, v_user_id
  from public.student_accounts sa
  where sa.student_id = p_student_id;

  if v_workspace_id is null then
    return; -- Nothing linked. Removing nothing is not an error.
  end if;

  if not private.is_workspace_owner(v_workspace_id) then
    raise exception 'Only the workspace owner may remove a learner''s access.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.student_accounts
  where student_id = p_student_id;

  -- Only the membership this function created. A user who is somehow also staff
  -- keeps that role, because this function did not grant it.
  delete from public.workspace_members
  where workspace_id = v_workspace_id
    and user_id = v_user_id
    and role = 'student';
end;
$$;

comment on function public.unlink_student_account is
  'Owner-only. Revokes portal access. Teaching records are left untouched.';

revoke all on function public.unlink_student_account(uuid) from public;
grant execute on function public.unlink_student_account(uuid) to authenticated;
