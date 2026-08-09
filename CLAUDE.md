# Teacher OS project instructions

## Mission

Turn the existing Teacher OS frontend into a secure, maintainable application
with real teacher and student accounts and persistent customizable data.
Preserve the current visual language and the primary teaching workflow.

## Non-negotiable product rules

1. ESL and IELTS Academic are different teaching tracks.
2. They must retain different dashboards, navigation, progress models,
   assessments and reports.
3. Shared operational areas may serve both tracks: Calendar, Tasks, Goals,
   Projects and Materials.
4. The primary workflow is:

   Upcoming lesson → homework status → homework checking → lesson preparation
   → lesson delivery → post-class notes → homework assignment → progress
   update → next lesson preparation.

5. Never merge ESL progress and IELTS band tracking into one generic score.
6. Preserve the existing interface unless a change is required for usability,
   accessibility, security or real data.
7. Never place secrets in browser code, Git, fixtures or documentation.

## Current architecture

- Next.js 16 App Router and React 19.
- Vinext/Vite builds the app for a Cloudflare Worker.
- The complete UI is currently concentrated in the 1,210-line
  `app/page.tsx` client component and the 780-line `app/globals.css`.
- Demonstration records are constants in `app/page.tsx`.
- UI changes use local React state and are not persistent.
- Navigation is represented by `track`, `view` and optional `detail`
  query parameters.
- `db/schema.ts` contains no tables.
- The existing tests verify build output and that rendered buttons have
  interaction handlers.

Do not begin by rewriting the UI. First map the current views, mock records,
state transitions and URL behavior.

## Recommended production direction

The preferred target is:

- Standard Next.js App Router with TypeScript.
- Supabase Postgres, Auth and Storage.
- Server-side authorization plus Row Level Security on every exposed table.
- Vercel production and preview deployments.
- SQL migrations and generated database types committed to the repository.

Before changing the existing Vinext/Cloudflare build, write a short
architecture decision explaining whether to:

1. migrate to standard Next.js and Vercel, or
2. retain the current Cloudflare runtime while using Supabase.

Choose one path and avoid maintaining two production runtimes.

## Required roles

- Owner: controls the workspace and all records.
- Teacher: accesses assigned students and teaching records.
- Student: accesses only their own lessons, homework, submissions, feedback
  and progress.

A later guardian role may be designed, but it is not part of the first release.

## Implementation rules

- Work in small, reviewable phases.
- Establish a clean baseline commit before editing.
- Add migrations before application code that depends on them.
- Keep core reporting fields strongly typed.
- Use `jsonb` only for genuinely customizable fields.
- Keep authorization in the database and server, not only in hidden UI.
- Keep the Supabase service-role key server-only.
- Add loading, empty, success and error states to every real-data screen.
- Preserve URL-aware navigation and keyboard accessibility.
- Run lint, type checking, tests and production build before completing a
  phase.
- Test data isolation with two teachers and two students.

## First production vertical slice

Implement this complete workflow before converting every dashboard:

1. Owner signs in.
2. Owner creates an ESL or IELTS student.
3. Owner schedules a lesson.
4. Owner records lesson preparation.
5. Owner assigns homework.
6. Student signs in and submits homework.
7. Owner records feedback.
8. Owner updates track-specific progress.
9. The next lesson shows the new homework and progress context.

## Definition of done

A feature is not complete until its data persists after refresh, authorization
is enforced, errors are handled, the existing navigation remains functional,
and automated tests cover the critical permission boundary.

