# `lib/fixtures` — the data seam

Every module here exports an **empty**, fully typed collection.

## Why it exists

Before this directory, roughly 90 demo records were hard-coded inside
`app/page.tsx` — students, lessons, homework, band scores, materials, tasks.
They were removed on 10 August 2026 at the owner's request.

Deleting them outright would have thrown away the only specification of what
each screen actually needs. So the shapes were preserved as types in
`lib/types/domain.ts`, and the data itself was emptied here.

## The contract

This directory is the seam between the interface and the database.

- **Today:** each module exports an empty array or `null`. Every screen renders
  its empty state.
- **Phase 2:** `lib/types/domain.ts` is the source the SQL migrations are
  derived from.
- **Phase 3 onward:** a module is replaced, one at a time, by an authorized
  server-side query returning the same type. **No component changes.** That is
  the whole point of routing the data through here.

## Rules

1. **Never reintroduce sample records.** If a screen needs data to be
   demonstrated, sign in and create it. A fixture that returns fake rows will
   eventually be mistaken for real ones, and there is no longer any UI signal
   distinguishing the two.
2. **Empty is a real state, not a placeholder.** A teacher with no students yet
   sees exactly what these fixtures produce. If that looks broken, the fix is an
   empty state in the component — not fake data here.
3. **Types change first.** If a screen needs a new field, add it to
   `lib/types/domain.ts`, then to the migration, then to the query.
4. **ESL and IELTS stay separate.** `esl-progress.ts` and `ielts-progress.ts`
   are distinct files because CEFR mastery and IELTS bands are different
   measurements on different scales. Merging them is a product regression
   (CLAUDE.md rule 5), not a simplification.

## Recovering the original demo data

It is in git, permanently:

```bash
git show 294b548:app/page.tsx
```
