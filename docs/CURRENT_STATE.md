# Current state

Last updated 11 August 2026, after building the student portal.

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
app/                route, auth screens, layout, four stylesheets
  page.tsx          server component — resolves the session, renders the shell
  (auth)/           sign-in and sign-up (route group; URLs are /sign-in, /sign-up)
  auth/callback/    exchanges the email-confirmation code for a session
proxy.ts            session refresh + redirect for signed-out requests
components/         primitives, dashboard triage panels, auth form, workspace shell
  planner/          lesson preparation — brief, rundown, readiness
  homework/         homework checking — queue and marking pane
  progress/         two entry forms, one per track, deliberately not shared
  students/         owner panel for granting and revoking portal access
  student/          the learner's own shell — a different product, not a filter
lib/supabase/       browser / server / admin clients, and `isSupabaseConfigured`
lib/auth/           session resolution and the sign-in/up/out server actions
lib/dashboard/      triage rules — pure functions, every one takes `now` explicitly
lib/types/          domain.ts is the contract the Supabase schema derives from
lib/queries/        server-side reads; return the exact shapes the fixtures did
lib/fixtures/       the remaining seam; being replaced by queries one module at a time
lib/actions/        write path, shaped like the server action it will become
supabase/migrations/ 12 migrations, 27 tables, RLS on every one
tests/              Vitest — 260 tests, including 83 against a real Postgres
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
- **Lesson preparation.** Pick an upcoming lesson, write the objective — a CEFR
  outcome on ESL, a band objective on IELTS — build a timed lesson flow, and
  save or mark it ready. Readiness is reported from the saved record using the
  same derivation as the dashboard, not from tick boxes; a checklist a teacher
  can lie to is worse than none.
- **Homework checking.** The queue of work waiting on the teacher, the learner's
  submission, and a feedback pane. Saving and releasing are separate actions:
  the learner reads nothing until `released_at` is set, which Postgres enforces.
- **Progress entry**, one form per track and never merged: CEFR mastery
  percentages for ESL, half-band selects for IELTS. Both can record privately or
  share with the learner. Skills left blank are not sent — an unobserved skill is
  not a zero.
- **The student portal.** A learner signs up themselves, the owner links that
  email address to their learner record, and they get their own shell: what they
  owe, when their next class is, and how they are doing. They can save a draft
  or send it, and they read feedback and progress only once the teacher has
  released it. This completes the eight-step vertical slice in CLAUDE.md.
- Per-area filtering and sorting within a session.
- Every screen has a designed empty state.

- Sign in, sign up, sign out, and email confirmation, in the existing visual
  language.
- Self-service onboarding: a new user names their workspace and becomes its
  owner, without anyone touching SQL.
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
- **All eight workflow steps now have a screen.** The one quick action still
  without a form is recording an assessment, because it needs a set of criteria
  to score against and those differ per track. It says so rather than showing a
  form that cannot succeed.
- **A learner cannot create their own account from an invitation.** They sign up
  at `/sign-up` like anyone else, and the owner then links the address. Doing it
  the other way — the teacher creating the account — means the teacher choosing
  someone else's password, which this application will not do. An emailed invite
  link is the right fix and needs Supabase's invite flow.
- **The four-column homework board is not rendered.** `getTriageData` fetches
  only work waiting on the teacher, so a board would show two permanently empty
  columns and imply nothing was ever assigned. `HOMEWORK_COLUMNS`,
  `HOMEWORK_COLUMN_LABELS` and `homeworkBoardByTrack` remain in `lib/fixtures/`
  as the contract for when the assigned and returned queries land.
- **Nothing attaches a material to a lesson.** The prep checklist used to claim
  otherwise: it read `lesson_plans.blocks` and reported the count as "Materials
  attached". The field is now `plannedBlocks` and the item reads "Lesson flow
  prepared", which is what it actually measures. A real materials link needs a
  join table and the file-upload path.
- **The portal has no file upload.** The storage buckets and their policies
  exist (`0009_storage.sql`), so a learner may already upload to their own
  submission folder — there is simply no control for it yet. Text-only
  submissions until there is.
- No email or calendar integration.
- Reports and several area screens are structure without data.

## Cautions carried forward

- Preserve the URL behaviour when real routes or data arrive.
- Do not infer authorization from the selected ESL/IELTS tab. It is a view
  filter, not a boundary.
- Do not use one generic progress table for both tracks. CEFR mastery and IELTS
  bands are different measurements on different scales.
- Do not treat a toast or a closed drawer as a successful write.
- Releasing is a separate act from saving, for both feedback and progress. A
  screen that always sent `release: true` would make the policy that protects
  half-written feedback unreachable, and nothing would fail loudly.
- `link_student_account` and `unlink_student_account` are SECURITY DEFINER, so
  RLS does not run inside them. Their owner check is an explicit `if` in the
  function body and is the only thing standing between a teacher and every email
  address in the system. Do not move, weaken or short-circuit it — and if you
  edit either function, keep `tests/db/student-portal.test.ts` passing.
- `lib/dashboard/` thresholds are pedagogical judgements. Change them
  deliberately, and update the tests that state them.

## Verification

```bash
npm run verify
```

Type checking, lint, 260 tests and a production build. All green as of this
commit.

New test files are checked against deliberately introduced bugs before being
trusted, because a test that has never failed has not been shown to test
anything. So far: sending `release: true` from the save button, sending `0` for
unobserved skills, dropping the `submissions` prop on the way into the homework
screen, removing the owner check from `link_student_account`, rendering
unreleased feedback in the portal, and letting a learner edit work already sent.
Each was caught, then reverted.
