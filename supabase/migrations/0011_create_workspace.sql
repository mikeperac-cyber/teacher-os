-- Workspace bootstrap.
--
-- THE DEADLOCK THIS FIXES
-- -----------------------
-- A newly signed-up user could not create a workspace at all:
--
--   1. `insert into workspaces ... returning id` applies the SELECT policy to
--      the returned row. That policy required membership, which does not exist
--      yet, so the insert was refused with 42501. (Same shape as the students
--      bug fixed in 0003 — `INSERT ... RETURNING` is a read as well as a write,
--      and `.select()` is how the Supabase client always writes.)
--
--   2. Even without RETURNING, the follow-up
--      `insert into workspace_members ... role = 'owner'` required
--      `is_workspace_owner(workspace_id)`, which reads workspace_members —
--      still empty. So the owner could not join the workspace they had just
--      created.
--
-- The result was an account that could sign in and then do nothing at all,
-- which is exactly what the onboarding screen was showing.
--
-- Two changes below: the SELECT policy stops depending on membership alone, and
-- a single function creates both rows atomically.

-- ---------------------------------------------------------------------------
-- 1. An owner can see their own workspace
-- ---------------------------------------------------------------------------
--
-- `owner_id` is a column on the candidate row, so this needs no self-query and
-- is true the instant the row exists — including inside INSERT ... RETURNING.

drop policy if exists "workspaces are readable by their members" on public.workspaces;

create policy "workspaces are readable by their members or owner"
  on public.workspaces for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_workspace_member(id)
  );

-- ---------------------------------------------------------------------------
-- 2. Atomic bootstrap
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, which needs justifying because it bypasses RLS.
--
-- It is safe here because the function takes no identity parameter. Both the
-- workspace owner and the membership row are hard-wired to `auth.uid()`, so a
-- caller can only ever create a workspace for themselves and make themselves
-- its owner. There is no argument they can pass to act as anyone else.
--
-- The alternative — loosening the workspace_members INSERT policy so a user may
-- add themselves as owner — would widen a policy that otherwise says "only
-- owners manage membership", for one bootstrap case. A narrow function is
-- easier to review than a broadened rule.

create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_workspace_id uuid;
  trimmed_name text := btrim(coalesce(p_name, ''));
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if trimmed_name = '' then
    raise exception 'A workspace needs a name' using errcode = '23514';
  end if;

  -- One workspace per owner for now. A teacher running two businesses is a
  -- real case, but it needs a switcher in the interface first, and silently
  -- creating a second one they cannot reach would be worse than refusing.
  if exists (
    select 1 from public.workspaces w where w.owner_id = caller
  ) then
    raise exception 'You already own a workspace' using errcode = '23505';
  end if;

  insert into public.workspaces (name, owner_id)
  values (trimmed_name, caller)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, caller, 'owner');

  return new_workspace_id;
end;
$$;

comment on function public.create_workspace is
  'Creates a workspace and its owner membership atomically. SECURITY DEFINER, but takes no identity argument — both rows are hard-wired to auth.uid(), so a caller can only ever set themselves up.';

grant execute on function public.create_workspace(text) to authenticated;
