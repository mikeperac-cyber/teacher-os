# Connecting a Supabase project

The schema is written and tested, but no Supabase project exists yet. Creating
one needs your account, so these are the steps for you rather than for Claude.

Nothing in the application reads these variables yet — that lands with the
client wiring in the next phase. Doing this first means the migrations can be
applied and verified against a real project before any code depends on them.

## 1. Create two projects

Create **two** projects, not one: `teacher-os-dev` and `teacher-os-prod`.
Migrations get applied to dev first and only promoted once they behave.

Production must be on a paid tier before any real student record is entered —
free projects pause when idle, and a paused project is an outage.

Choose a region close to your learners; it sets round-trip latency for every
query.

## 2. Fill in `.env.local`

Copy `.env.example` to `.env.local` and fill it from
**Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable / anon key>
SUPABASE_SERVICE_ROLE_KEY=<the service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is gitignored. The service-role key bypasses every Row Level
Security policy in this repository — it belongs in server-side code and in
Vercel's encrypted environment variables, never in a client component, never in
`NEXT_PUBLIC_*`, and never in a commit.

## 3. Apply the migrations

```bash
npx supabase link --project-ref <your-dev-project-ref>
```

```bash
npx supabase db push
```

`db push` applies everything in `supabase/migrations/` in filename order. It is
the only supported way to change the schema — do not edit tables through the
dashboard, or the repository stops describing the database.

## 4. Confirm the policies survived the trip

```bash
npm test
```

That runs the suite in `tests/db/` against an in-process Postgres, so it passes
without a project at all. What it cannot prove is that Supabase's own default
grants and PostgREST exposure match its assumptions.

So after pushing, check in the dashboard:

- **Database → Tables**: every table shows RLS enabled.
- **Database → Roles**: `anon` has no unexpected grants.
- **Storage**: all four buckets exist and none is public.

## 5. Auth settings

Under **Authentication → Providers**, email is enough for the first release.

Under **Authentication → URL Configuration**, add your redirect URLs:
`http://localhost:3000/**` for development, and the Vercel preview and
production domains once they exist. Sign-in fails with an opaque redirect error
if these are missing.

Leave "Confirm email" on. It is the only thing stopping someone from signing up
as an address they do not control.

## 6. Create the first workspace

The signup trigger creates a profile automatically, but a new user belongs to no
workspace and will therefore see nothing — correctly, since every policy is
scoped by membership.

Until the owner-onboarding flow exists, create the first workspace by hand in
the SQL editor:

```sql
insert into public.workspaces (name, owner_id)
values ('My teaching', '<your auth user id>')
returning id;

insert into public.workspace_members (workspace_id, user_id, role)
values ('<the workspace id>', '<your auth user id>', 'owner');
```

Both rows are required. A workspace whose owner has no membership row is
invisible to its own owner.

## What comes next

With a project connected: the Supabase client wiring (`@supabase/ssr` plus
middleware session refresh), sign-in and sign-up screens in the existing visual
language, and a role-aware shell so a student sees a student's application
rather than a teacher's.
