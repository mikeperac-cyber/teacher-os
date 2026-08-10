# Current state

Last updated 10 August 2026, after Phase 3.

For the original export's state, see `git show 294b548` and the version of this
file at that commit.

## Architecture

- Standard **Next.js 16 App Router**, React 19, TypeScript, built and run with
  the Next CLI. No WSL, bash helpers or GNU utilities required.
- One route (`/`), a client component, with navigation expressed as
  `?track=esl|ielts&view=<area>&detail=<slug>`.
- Target deployment is Vercel with Supabase for Postgres, Auth and Storage —
  see `adr/0001-production-runtime-and-database.md`.

```
app/                route, auth screens, layout, three stylesheets
  page.tsx          server component — resolves the session, renders the shell
  (auth)/           sign-in and sign-up (route group; URLs are /sign-in, /sign-up)
  auth/callback/    exchanges the email-confirmation code for a session
proxy.ts            session refresh + redirect for signed-out requests
components/         primitives, dashboard triage panels, auth form, workspace shell
lib/supabase/       browser / server / admin clients, and `isSupabaseConfigured`
lib/auth/           session resolution and the sign-in/up/out server actions
lib/dashboard/      triage rules — pure functions, every one takes `now` explicitly
lib/types/          domain.ts is the contract the Supabase schema derives from
lib/queries/        server-side reads; return the exact shapes the fixtures did
lib/fixtures/       the remaining seam; being replaced by queries one module at a time
lib/actions/        write path, shaped like the server action it will become
supabase/migrations/ 9 migrations, 27 tables, RLS on every one
tests/              Vitest — 137 tests, including 56 against a real Postgres
```

## What works

- ESL / IELTS workspace switching, with genuinely separate dashboards,
  navigation, progress models and reports.
- URL-aware navigation, back/forward restoration, deep links.
- Global search overlay and ⌘/Ctrl-K.
- Dashboard triage: next-up lesson with prep blockers, merged action inbox,
  at-risk learners, week capacity, goal reviews due, derived clickable stats.
- Quick actions open a real modal with real validation, from both the dashboard
  and the topbar.
- Per-area filtering and sorting within a session.
- Every screen has a designed empty state.

- Sign in, sign up, sign out, and email confirmation, in the existing visual
  language.
- A session resolved on the server and passed into the shell as a prop, so the
  browser is never asked who the user is.

## What is not built yet

- **No Supabase project provisioned.** The schema, policies and client wiring
  all exist and are tested, but nobody has created the project yet — that needs
  Mike's account. See `SUPABASE_SETUP.md`.

  Until then the app runs in a deliberate "unconfigured" state: it starts, every
  screen renders, and the sidebar says *Not connected* rather than pretending
  someone is signed in. `isSupabaseConfigured` is checked before any client is
  built, so nothing throws.
- **No data**, because there is no project to hold any. The dashboard now reads
  through `lib/queries/triage.ts` rather than fixtures, and returns empty until
  a project exists.
- **The workflow actions have no dedicated UI yet.** `lib/actions/workflow.ts`
  implements all eight steps of the vertical slice and they are proven against a
  real Postgres in `tests/db/workflow.test.ts`, but only "create student" has a
  form wired to it. Scheduling, preparation, submission, feedback and progress
  entry still need screens.
- **No student shell.** Role reaches the interface, but a student currently sees
  the same layout as a teacher. They would read nothing they should not — RLS
  refuses it in Postgres — but the screens are not yet built for them.
- No file upload or download; no email or calendar integration.
- Reports and several area screens are structure without data.

## Cautions carried forward

- Preserve the URL behaviour when real routes or data arrive.
- Do not infer authorization from the selected ESL/IELTS tab. It is a view
  filter, not a boundary.
- Do not use one generic progress table for both tracks. CEFR mastery and IELTS
  bands are different measurements on different scales.
- Do not treat a toast or a closed drawer as a successful write.
- `lib/dashboard/` thresholds are pedagogical judgements. Change them
  deliberately, and update the tests that state them.

## Verification

```bash
npm run verify
```

Type checking, lint, 137 tests and a production build. All green as of this
commit.
