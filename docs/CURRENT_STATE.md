# Current state

Last updated 11 August 2026, after connecting the dev Supabase project.

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
supabase/migrations/ 10 migrations, 27 tables, RLS on every one
tests/              Vitest — 173 tests, including 62 against a real Postgres
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

- **No production project.** `teacher-os-dev` exists and all 10 migrations are
  applied to it (verified 11 August 2026 — see `SUPABASE_SETUP.md`). Production
  is not provisioned, and must be on a paid tier before any real student record
  is entered.
- **No data yet.** The dashboard reads through `lib/queries/triage.ts` and
  returns empty until learners are created.
- **A teacher cannot record a submission on a learner's behalf.** Only the
  learner may insert into `homework_submissions`. That is what the policy says
  and the round trip confirmed it (`42501`). It is a deliberate boundary, but it
  means paper homework, or work a learner emails over, currently has nowhere to
  go. Needs a product decision before a staff INSERT policy is added.
- **Four of the eight workflow steps have no screen yet.** Creating a learner,
  scheduling a lesson and assigning homework all write for real from the quick
  actions. Lesson preparation, student submission, feedback and progress entry
  are implemented in `lib/actions/workflow.ts` and proven against a real
  Postgres in `tests/db/workflow.test.ts`, but have no form.

  Recording an assessment is the one quick action with no form, because it needs
  a set of criteria to score against and those differ per track. It says so
  rather than showing a form that cannot succeed.
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

Type checking, lint, 173 tests and a production build. All green as of this
commit.
