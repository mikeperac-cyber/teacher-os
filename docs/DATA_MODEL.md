# Data model

**The migrations in `supabase/migrations/` are authoritative.** This file
explains the shape and the reasoning; where the two disagree, the SQL is right
and this file is stale.

The schema is derived from `lib/types/domain.ts`, which was itself extracted
from what the interface actually renders — not designed in the abstract.

## Migration order

| File | Contents |
| --- | --- |
| `0001_foundation` | `private` schema, enums, `updated_at` trigger |
| `0002_identity` | profiles, workspaces, membership, **authorization helpers** |
| `0003_students` | students, student logins, teacher assignment, `can_access_student` |
| `0004_lessons` | lessons, lesson plans, lesson notes |
| `0005_homework` | assignments, submissions, feedback |
| `0006_esl_progress` | CEFR mastery and language outcomes |
| `0007_ielts_progress` | band scores, mocks, Writing and Speaking criteria |
| `0008_operations` | tasks, goals, projects, calendar, capacity, materials, files |
| `0009_storage` | buckets and their policies |

Conventions: RLS is enabled in the same migration that creates a table; policies
are written per operation; every business table carries `workspace_id` and every
student-owned table also carries `student_id`.

## Track separation

ESL and IELTS are separate tracking systems (CLAUDE.md rules 1, 2, 5), and the
schema enforces it:

- `esl_progress_entries` stores **percentages** (0–100): how reliably a learner
  uses a language system.
- `ielts_skill_scores` stores **bands** via the `band_score` domain — 0–9 in
  half-band steps. The domain rejects 6.3, which no examiner can award.

They are not convertible. Do not add a view or table that unifies them into one
"score" — that would destroy the meaning of both.

`language_outcomes` has no IELTS equivalent by design: the gap between what a
learner recognises and what they produce unprompted is the core ESL diagnostic.

## Authorization

All access reduces to helpers in the `private` schema. They are
`SECURITY DEFINER` because a policy on `workspace_members` that queries
`workspace_members` would recurse forever. That makes them a privilege boundary,
so each pins `search_path = ''` and lives outside the API schema.

| Helper | Answers |
| --- | --- |
| `is_workspace_member(ws)` | Does the caller belong to this workspace? |
| `is_workspace_owner(ws)` | Do they own it? |
| `is_workspace_staff(ws)` | Are they an owner or teacher? |
| `can_access_student(id)` | May staff reach this learner? Owner: any in workspace. Teacher: only if assigned. |
| `is_own_student_record(id)` | Is the caller this learner? |

`can_access_student` deliberately excludes students. Their access is expressed
separately on each table and is narrower — read-only for most, release-gated for
feedback and scores. One combined helper would make it far too easy to hand a
student a staff-shaped permission by accident.

## Access matrix

| Table | Owner | Teacher | Student |
| --- | --- | --- | --- |
| `students` | all in workspace | assigned only | own record |
| `lessons` | all | assigned | own |
| `lesson_plans` | all | assigned | **none** |
| `lesson_notes` | all | assigned | only where `shared_with_student` |
| `homework_assignments` | all | assigned | own |
| `homework_submissions` | all | assigned | own; write only while `draft` |
| `homework_feedback` | all | assigned | own, only once `released_at` is set |
| `esl_progress_entries` | all | assigned | own, released only |
| `ielts_*` scores | all | assigned | own, released only |
| `tasks`, `calendar_events`, `day_capacities` | own rows | own rows | none |
| `goals`, `projects`, `materials` | workspace staff | workspace staff | own goals only |
| `files` | staff, scoped by student | assigned | own |

Two policies carry most of the weight:

**Submission escalation.** A student may edit their own submission only while it
is a draft (`USING`), and may write no status beyond `submitted` (`WITH CHECK`).
Without the second clause a student could mark their own homework `returned`.

**Feedback release.** Students see feedback and scores only once `released_at`
is set, so a teacher can mark incrementally without the learner watching a first
harsh draft appear.

## Storage

Four private buckets: `homework-submissions`, `speaking-recordings`,
`materials`, `avatars`. Nothing is public.

Authorization derives from the object path, so **the layout is part of the
security model**:

```
homework-submissions   {workspace_id}/{student_id}/{submission_id}/{file}
speaking-recordings    {workspace_id}/{student_id}/{recording_id}/{file}
materials              {workspace_id}/{material_id}/{file}
avatars                {user_id}/{file}
```

Path segments are untrusted text, so they go through `private.safe_uuid`, which
returns null on anything malformed rather than raising — a bad filename becomes
a clean denial instead of a request error.

Students may upload their own submissions and recordings but may not delete
them: a student able to delete marked work could erase the evidence behind their
own feedback.

## Verification

```bash
npm test
```

`tests/db/` runs the migrations against a real Postgres (PGlite, in-process —
no Docker or cloud project needed) and asserts the boundary with two workspaces,
two teachers and two students, exactly as CLAUDE.md requires. Every assertion
runs as a specific user with RLS enforced; none uses a service-role connection,
because a test that bypasses RLS to check RLS proves nothing.

`migrations.test.ts` additionally fails the build if any table is added without
RLS, without a policy, or if any `SECURITY DEFINER` function is added without a
pinned `search_path`.

## Known gaps

- **Students cannot read `materials`.** Sharing one with a learner needs an
  explicit link table (material → lesson or assignment) so the grant stays
  narrow. Deferred rather than approximated with a workspace-wide grant.
- `rubric_templates` / `rubric_criteria` are not yet implemented.
- No guardian role — out of scope for the first release.
