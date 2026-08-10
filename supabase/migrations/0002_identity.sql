-- Identity and tenancy: profiles, workspaces, membership.
--
-- This migration also defines the authorization helpers every later policy
-- depends on. Read the note on SECURITY DEFINER below before changing them.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for an authenticated user. One row per auth.users row.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspaces is
  'A teaching business. The tenancy boundary: every business record belongs to exactly one workspace.';

create index workspaces_owner_id_idx on public.workspaces (owner_id);

create trigger set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

alter table public.workspaces enable row level security;

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Which users belong to which workspace, and in what role. Authorization is derived from this table and never from the selected ESL/IELTS track.';

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

create trigger set_updated_at
  before update on public.workspace_members
  for each row execute function private.set_updated_at();

alter table public.workspace_members enable row level security;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
--
-- WHY THESE ARE SECURITY DEFINER
-- ------------------------------
-- A policy on workspace_members that queries workspace_members to decide access
-- recurses infinitely. Marking the helper SECURITY DEFINER makes its internal
-- query run as the function owner, which bypasses RLS on the tables it reads
-- and breaks the cycle.
--
-- That makes these functions a privilege boundary. Two rules follow:
--
--   1. `set search_path = ''` on every one, with all names schema-qualified.
--      Otherwise a caller can create a schema earlier in the search path and
--      shadow the objects the function resolves.
--   2. They live in `private`, which is not exposed through PostgREST, so they
--      cannot be called directly as RPC.
--
-- Each answers exactly one question and reads only what it needs.

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function private.is_workspace_staff(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'teacher')
  );
$$;

comment on function private.is_workspace_staff is
  'True for owners and teachers. Used where a grant applies to staff generally; student access is always expressed separately and more narrowly.';

-- Workspaces the current user belongs to. Returned as a set so policies can
-- write `workspace_id in (select private.current_workspace_ids())`.
create or replace function private.current_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Policies: profiles
-- ---------------------------------------------------------------------------

create policy "profiles are readable by the owner of the profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Teachers need to see each other's names; a student never needs the directory,
-- so this is limited to staff rather than all members.
create policy "profiles are readable by staff in a shared workspace"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.user_id = public.profiles.id
        and private.is_workspace_staff(m.workspace_id)
    )
  );

create policy "a user may update only their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Insert is handled by the trigger below, running as definer. No INSERT policy
-- is granted: application code must never create profiles directly.

-- ---------------------------------------------------------------------------
-- Policies: workspaces
-- ---------------------------------------------------------------------------

create policy "workspaces are readable by their members"
  on public.workspaces for select
  to authenticated
  using (private.is_workspace_member(id));

create policy "a user may create a workspace they own"
  on public.workspaces for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "workspaces are updatable by their owner"
  on public.workspaces for update
  to authenticated
  using (private.is_workspace_owner(id))
  with check (private.is_workspace_owner(id));

create policy "workspaces are deletable by their owner"
  on public.workspaces for delete
  to authenticated
  using (private.is_workspace_owner(id));

-- ---------------------------------------------------------------------------
-- Policies: workspace_members
-- ---------------------------------------------------------------------------

create policy "a user may read their own membership"
  on public.workspace_members for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "owners may read every membership in their workspace"
  on public.workspace_members for select
  to authenticated
  using (private.is_workspace_owner(workspace_id));

-- Only owners manage membership. A teacher cannot add themselves to a
-- workspace, and cannot promote themselves to owner.
create policy "owners may add members"
  on public.workspace_members for insert
  to authenticated
  with check (private.is_workspace_owner(workspace_id));

create policy "owners may change memberships"
  on public.workspace_members for update
  to authenticated
  using (private.is_workspace_owner(workspace_id))
  with check (private.is_workspace_owner(workspace_id));

create policy "owners may remove members"
  on public.workspace_members for delete
  to authenticated
  using (private.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- Profile creation
-- ---------------------------------------------------------------------------

-- Creates the profile row when a user signs up, so application code never has
-- to and there is no window in which an authenticated user has no profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
