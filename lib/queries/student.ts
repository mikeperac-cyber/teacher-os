import "server-only";

/**
 * Everything the learner's portal needs, fetched once per request.
 *
 * There is no `student_id` filter anywhere below, and that is deliberate — the
 * same decision as `triage.ts`. Every one of these tables carries a policy
 * keyed on `private.is_own_student_record`, so Postgres already returns exactly
 * one learner's rows. Adding a WHERE clause would be a second, weaker copy of
 * that rule, and the two would eventually disagree.
 *
 * The one lookup that *is* explicit is `student_accounts`, because that is how
 * the request discovers which learner it is in the first place.
 */

import { createClient } from "@/lib/supabase/server";
import { toTrackLabel } from "@/lib/types/database";
import { emptySnapshot } from "@/lib/types/student";
import type { StudentSnapshot } from "@/lib/types/student";

import { firstOf } from "./mappers";
import {
  mapEslEntry,
  mapIeltsScore,
  mapStudentHomework,
  mapStudentLesson,
  sortHomework,
  type EslEntryRow,
  type IeltsScoreRow,
  type StudentAssignmentRow,
  type StudentLessonRow,
} from "./student-mappers";

/** How far back a finished lesson still shows in the learner's list. */
const RECENT_LESSON_DAYS = 7;

export async function getStudentSnapshot(now: Date): Promise<StudentSnapshot> {
  const supabase = await createClient();
  if (!supabase) return emptySnapshot();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptySnapshot();

  // Which learner is this? A signed-in user with no link is not an error — it
  // is a teacher, or someone an owner has not linked yet.
  const { data: link } = await supabase
    .from("student_accounts")
    .select("student_id, workspace_id, students ( full_name, track )")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!link) return emptySnapshot();

  const student = firstOf<{ full_name: string; track: "esl" | "ielts" }>(
    link.students,
  );
  if (!student) return emptySnapshot();

  const track = toTrackLabel(student.track);
  const since = new Date(
    now.getTime() - RECENT_LESSON_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [lessonsResult, assignmentsResult, notesResult, eslResult, ieltsResult] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, track, starts_at, ends_at")
        .gte("starts_at", since)
        .order("starts_at", { ascending: true }),

      supabase
        .from("homework_assignments")
        .select(
          `id, title, instructions, track, due_at, estimated_minutes,
           homework_submissions ( id, status, body, homework_feedback ( body, released_at ) )`,
        )
        .order("due_at", { ascending: true, nullsFirst: false }),

      // The policy only returns notes flagged `shared_with_student`, so no
      // filter is needed here either.
      supabase
        .from("lesson_notes")
        .select("lesson_id, body")
        .order("created_at", { ascending: false }),

      // Both progress queries are issued, but only the one matching this
      // learner's track is read. The other returns nothing anyway — an ESL
      // learner has no band scores — and issuing both keeps the code free of a
      // branch that would have to be kept in step with the track enum.
      track === "ESL"
        ? supabase
            .from("esl_progress_entries")
            .select(
              "id, recorded_at, grammar, vocabulary, speaking, listening, reading, confidence, overall, note",
            )
            .order("recorded_at", { ascending: false })
        : Promise.resolve({ data: [] }),

      track === "IELTS"
        ? supabase
            .from("ielts_skill_scores")
            .select("id, recorded_at, skill, band")
            .order("recorded_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const noteByLesson = new Map<string, string>();
  for (const row of (notesResult.data ?? []) as {
    lesson_id: string | null;
    body: string;
  }[]) {
    if (row.lesson_id && !noteByLesson.has(row.lesson_id)) {
      noteByLesson.set(row.lesson_id, row.body);
    }
  }

  const lessons = ((lessonsResult.data ?? []) as StudentLessonRow[]).map((row) =>
    mapStudentLesson(row, noteByLesson.get(row.id) ?? null),
  );

  const homework = sortHomework(
    ((assignmentsResult.data ?? []) as StudentAssignmentRow[]).map(
      mapStudentHomework,
    ),
  );

  return {
    learner: {
      studentId: link.student_id as string,
      workspaceId: link.workspace_id as string,
      fullName: student.full_name,
      track,
    },
    lessons,
    homework,
    progress:
      track === "ESL"
        ? {
            track: "ESL",
            entries: ((eslResult.data ?? []) as EslEntryRow[]).map(mapEslEntry),
          }
        : {
            track: "IELTS",
            bands: ((ieltsResult.data ?? []) as IeltsScoreRow[]).map(
              mapIeltsScore,
            ),
          },
  };
}
