# Migration plan

## Phase 0 — Protect the baseline

- Initialize a private Git repository.
- Commit this untouched export.
- Record baseline screenshots.
- Run the existing tests.
- Produce an architecture decision for hosting and Supabase integration.

## Phase 1 — Refactor without changing behavior

- Extract navigation, shell and track configuration.
- Extract the ESL and IELTS dashboards into separate modules.
- Extract reusable cards, drawers and shared controls.
- Move demonstration records into clearly named fixture modules.
- Keep the current query-parameter navigation operational.

## Phase 2 — Database and authentication

- Create Supabase projects for development and production.
- Add versioned SQL migrations.
- Add profiles, workspaces, membership and student-account linking.
- Implement teacher and student authentication.
- Add and test Row Level Security before real student information is entered.

## Phase 3 — First complete teaching workflow

- Student creation.
- Lesson scheduling and lesson preparation.
- Homework assignment.
- Student submission.
- Teacher checking and feedback.
- Post-class notes.
- ESL or IELTS-specific progress update.
- Context carried into the next lesson.

## Phase 4 — Track-specific intelligence

- Connect the ESL dashboard to CEFR evidence and communicative outcomes.
- Connect the IELTS dashboard to skill bands, rubric scores and test dates.
- Add assessment templates and customizable rubrics.
- Replace every static metric with a documented database query.

## Phase 5 — Files and operations

- Homework attachments and materials.
- Audio submissions and speaking recordings.
- Calendar synchronization if required.
- Notifications and email.
- Exportable student and business reports.

## Phase 6 — Production

- Create preview and production environments.
- Add backups and an account-deletion process.
- Test with two teachers and two students.
- Verify cross-account access is denied.
- Import real data only after the security tests pass.
- Deploy the production replacement without changing the reference site until
  the owner approves the cutover.

