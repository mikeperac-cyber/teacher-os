-- Teacher-recorded submissions.
--
-- A learner may not always submit through the portal: paper homework, work sent
-- by email, or a task completed in class. The previous policy allowed only the
-- learner to insert into homework_submissions, so that work had nowhere to go
-- (CURRENT_STATE.md). This adds a staff path without weakening the student one.
--
-- The student insert policy remains: a student may only create their own draft
-- or submitted row. The new staff policy is separate, so the two grants stay
-- greppable and neither can be used to escalate the other.

-- Staff may create a submission for any learner they can access.
-- Status is limited to the workflow values; a staff member should not create a
-- row already marked returned without going through feedback, but allowing it
-- here keeps the constraint in one place (the enum) and lets the server action
-- decide the valid transitions. `assigned_by` is not on this table — the
-- assignment already records who set the work.
create policy "staff may create submissions for students they can access"
  on public.homework_submissions for insert
  to authenticated
  with check (
    private.can_access_student(student_id)
    -- A staff member records what happened; they may set any workflow state,
    -- including returned when transcribing already-marked paper work.
    and status in ('draft', 'submitted', 'checking', 'returned')
  );

-- Staff may also insert directly via the submission path when a file is attached
-- outside the student's own upload. The storage policy already allowed staff
-- uploads for homework-submissions; this keeps the record side consistent.

comment on policy "staff may create submissions for students they can access"
  on public.homework_submissions is
  'Allows a teacher to record a submission on a learner behalf (paper, email, in-class). Student insert policy remains separate and narrower.';
