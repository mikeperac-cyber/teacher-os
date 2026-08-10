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
- **No database and no authentication yet.** Every collection resolves through
  `lib/fixtures/`, which currently returns empty, so every screen renders its
  empty state. That is the correct state for a workspace with no records.

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
| `app/` | Route, layout and the two stylesheets |
| `components/dashboard/` | Triage panels — next-up lesson, action inbox, at-risk, capacity, goals, quick actions |
| `lib/dashboard/` | The triage rules. Pure functions taking `now` explicitly, so thresholds are reviewable and testable |
| `lib/types/` | `domain.ts` is the field-level contract the Supabase schema is derived from |
| `lib/fixtures/` | The data seam. Empty today; replaced by queries one module at a time |
| `lib/actions/` | Write path. Has the shape a server action will take |
| `tests/` | Vitest suites over the rules and the create flow |

## Start locally

Node.js 22.13 or newer. No WSL required.

```bash
npm install
npm run dev
```

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
