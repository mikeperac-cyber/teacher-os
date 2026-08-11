# Teacher OS

A productivity application for a private 1:1 ESL and IELTS Academic teacher.

Originally a ChatGPT Sites export of Teacher OS version 4 (10 August 2026).
Visual reference: https://teacher-os.mike487612.chatgpt.site — kept as a
reference only. Do not reconnect this repository to that deployment.

## Current state

- Desktop-first interface with **separate ESL and IELTS workspaces** —
  different dashboards, navigation, progress models, assessments and reports.
  This separation is a product rule, not a styling choice; see `CLAUDE.md`.
- Shared Calendar, Tasks, Goals, Projects, Reports and Materials areas.
- URL-aware navigation: `?track=esl|ielts&view=<area>&detail=<slug>`.
- The dashboard is a triage surface — next lesson, what is blocking it, a
  merged action queue and at-risk learners.
- **Supabase Postgres, Auth and Storage**, with 12 SQL migrations, 27 tables and
  Row Level Security on every one. Authorization lives in the database, not in
  hidden UI.
- **Sign in, sign up and self-service onboarding.** The session is resolved on
  the server and passed into the shell as a prop; the browser is never asked who
  the user is.
- **The whole teaching workflow writes real records**: create a learner,
  schedule a lesson, prepare it, assign homework, check homework and give
  feedback, and record progress — CEFR mastery for ESL, band scores for IELTS.
- **A student portal.** A learner gets their own shell — what they owe, when
  their next class is, how they are doing — and submits their work from it.
  Feedback and progress reach them only once the teacher releases them, which
  Postgres enforces rather than the interface.

Not built yet: file uploads, email and calendar integration, and several area
screens that are structure without data. See
[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for the honest list.

Read [CLAUDE.md](CLAUDE.md), [docs/adr/0001-production-runtime-and-database.md](docs/adr/0001-production-runtime-and-database.md)
and the rest of [docs](docs) before making changes.

## Technology

- Next.js 16 App Router, React 19, TypeScript
- Tailwind PostCSS tooling plus the hand-written visual system in
  `app/globals.css`
- Lucide React icons
- Vitest for tests
- Target deployment: Vercel, with Supabase for Postgres, Auth and Storage
  (ADR 0001)

## Layout

| Path | Contents |
| --- | --- |
| `app/` | Route, auth screens, layout and four stylesheets |
| `components/dashboard/` | Triage panels — next-up lesson, action inbox, at-risk, capacity, goals, quick actions |
| `components/planner/` | Lesson preparation — brief, rundown, readiness |
| `components/homework/` | Homework checking — queue and marking pane |
| `components/progress/` | Two progress-entry forms, one per track, deliberately not shared |
| `components/student/` | The learner's own shell — a different product, not the teaching one filtered |
| `lib/dashboard/` | The triage rules. Pure functions taking `now` explicitly, so thresholds are reviewable and testable |
| `lib/types/` | `domain.ts` is the field-level contract the Supabase schema is derived from |
| `lib/queries/` | Server-side reads. `mappers.ts` is pure and tested; `triage.ts` is `server-only` |
| `lib/actions/` | Server actions. Authorization is not here — every write goes through RLS |
| `lib/supabase/` | Browser, server and admin clients. The service-role key never reaches a client bundle |
| `supabase/migrations/` | 12 migrations, 27 tables, RLS policies and the SECURITY DEFINER helpers |
| `tests/` | Vitest — 260 tests, 83 of them against a real Postgres via PGlite |

## Start locally

Node.js 22.13 or newer. No WSL required.

```bash
npm install
npm run dev
```

The app runs without a database — it shows the sign-in screen and says plainly
that no project is connected, rather than presenting a form that cannot work.

To run it against your own Supabase project, copy `.env.example` to `.env.local`
and follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md), which covers
applying the migrations and verifying RLS. **No key belongs in this repository** —
`.env*` is ignored, and `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## Verify

```bash
npm run verify
```

That runs type checking, lint, tests and a production build. The individual
steps are `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

## Where the demo data went

The original export hard-coded roughly 90 sample records in `app/page.tsx`.
They were removed on 10 August 2026, but their shapes were preserved first as
types in `lib/types/domain.ts` — that file is now the specification the database
schema is built from.

The records themselves remain in git:

```bash
git show 294b548:app/page.tsx
```
