-- Email and Calendar integrations.
--
-- No email or calendar integration existed; every report and several area
-- screens were structure without data. This adds a minimal, auditable
-- integration layer without storing secrets in the database.
--
-- Design:
--   * `integrations` — one row per workspace per provider, holding status and
--     non-secret config (calendar id, email from address, sync toggle). Tokens
--     are NOT stored here; they live in Vercel env or Supabase Vault, and the
--     row only records that a provider is connected.
--   * `integration_events` — append-only log of sync/email actions, for
--     debugging and for the Reports area to show "last synced".
--   * `calendar_events` is extended with integration columns so a synced event
--     can be traced.
--
-- Authorization: integrations are workspace-scoped and staff-only. Students have
-- no access.

-- ---------------------------------------------------------------------------
-- integrations
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null
    check (provider in ('google_calendar', 'outlook_calendar', 'google_gmail', 'resend', 'ical')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error', 'syncing')),
  -- Non-secret config only: calendarId, fromAddress, syncEnabled, etc.
  -- Must not contain tokens, refresh tokens or API keys.
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index integrations_workspace_idx on public.integrations (workspace_id);

create trigger set_updated_at
  before update on public.integrations
  for each row execute function private.set_updated_at();

alter table public.integrations enable row level security;

-- ---------------------------------------------------------------------------
-- integration_events
-- ---------------------------------------------------------------------------

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  integration_id uuid not null references public.integrations (id) on delete cascade,
  kind text not null check (kind in ('calendar_sync', 'email_sent', 'email_failed', 'calendar_push', 'calendar_pull')),
  subject text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index integration_events_integration_idx on public.integration_events (integration_id, created_at desc);
create index integration_events_workspace_idx on public.integration_events (workspace_id, created_at desc);

alter table public.integration_events enable row level security;

-- ---------------------------------------------------------------------------
-- Extend calendar_events for sync traceability
-- ---------------------------------------------------------------------------

alter table public.calendar_events
  add column if not exists integration_id uuid references public.integrations (id) on delete set null,
  add column if not exists external_id text,
  add column if not exists sync_status text check (sync_status in ('local', 'synced', 'pending', 'failed')) not null default 'local';

create index if not exists calendar_events_integration_idx on public.calendar_events (integration_id) where integration_id is not null;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create policy "staff may read integrations in their workspace"
  on public.integrations for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "owners and teachers may manage integrations"
  on public.integrations for insert
  to authenticated
  with check (private.is_workspace_staff(workspace_id));

create policy "staff may update integrations in their workspace"
  on public.integrations for update
  to authenticated
  using (private.is_workspace_staff(workspace_id))
  with check (private.is_workspace_staff(workspace_id));

create policy "owners may delete integrations"
  on public.integrations for delete
  to authenticated using (private.is_workspace_owner(workspace_id));

create policy "staff may read integration events"
  on public.integration_events for select
  to authenticated using (private.is_workspace_staff(workspace_id));

create policy "staff may log integration events"
  on public.integration_events for insert
  to authenticated
  with check (private.is_workspace_staff(workspace_id));

-- No update/delete on events: append-only log.
