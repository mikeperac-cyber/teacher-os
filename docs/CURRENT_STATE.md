# Current state

Last updated 10 August 2026, after Phase 1a.

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
app/            route, layout, globals.css (untouched from the export), dashboard.css
components/     primitives + dashboard triage panels
lib/dashboard/  triage rules — pure functions, every one takes `now` explicitly
lib/types/      domain.ts is the contract the Supabase schema derives from
lib/fixtures/   the data seam; empty, replaced by queries one module at a time
lib/actions/    write path, shaped like the server action it will become
tests/          Vitest — 69 tests
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

## What is not built yet

- **No database.** Every collection in `lib/fixtures/` returns empty, so every
  screen renders its empty state. That is correct for a workspace with no
  records, not a defect.
- **No authentication.** The sidebar reads "Not signed in". Roles, Row Level
  Security and the owner/teacher/student boundary are Phase 2.
- **No persistence.** `createRecord` validates and then refuses, reporting that
  nothing was stored. It must keep refusing until a database is behind it.
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

Type checking, lint, 69 tests and a production build. All green as of this
commit.
