# Proposed production data model

This is a starting contract. Implement it through versioned SQL migrations and
adjust it only after documenting the reason.

## Identity and tenancy

- `profiles`: application profile associated with an authenticated user.
- `workspaces`: teaching business or organization.
- `workspace_members`: user, workspace and role membership.
- `student_accounts`: optional link between a student record and a login.
- `teacher_student_assignments`: teacher access to specific students.

Every business record must include `workspace_id`. Every student-owned record
must also include `student_id`.

## Shared teaching records

- `students`
- `lessons`
- `lesson_plans`
- `lesson_notes`
- `homework_assignments`
- `homework_submissions`
- `homework_feedback`
- `assessments`
- `calendar_events`
- `tasks`
- `goals`
- `projects`
- `materials`
- `files`
- `rubric_templates`
- `rubric_criteria`

Use typed columns for IDs, status, dates, scores and reportable fields.
`custom_fields jsonb` may store teacher-defined metadata that is not used in
critical reporting.

## ESL-specific records

- `esl_student_profiles`
- `esl_progress_entries`
- `cefr_assessments`
- `language_outcomes`
- `vocabulary_mastery`

Track CEFR level, grammar, vocabulary, listening, reading, speaking,
pronunciation, fluency, confidence, controlled production, independent use and
communicative outcomes.

## IELTS Academic-specific records

- `ielts_student_profiles`
- `ielts_mock_tests`
- `ielts_skill_scores`
- `ielts_writing_submissions`
- `ielts_writing_scores`
- `ielts_speaking_recordings`
- `ielts_speaking_scores`
- `ielts_question_type_results`

Track test date, target overall band, Listening, Reading, Writing and Speaking
bands, raw scores and question types.

Writing criteria:

- Task Achievement or Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

Speaking criteria:

- Fluency and Coherence
- Lexical Resource
- Grammatical Range and Accuracy
- Pronunciation

## Row Level Security contract

- Owners can access all records in their workspace.
- Teachers can access records for assigned students.
- Students can access only their linked student record and permitted related
  records.
- Students may create or edit only explicitly allowed submission fields.
- Service-role operations run only on trusted server code.
- Every exposed table has RLS enabled and tested.

