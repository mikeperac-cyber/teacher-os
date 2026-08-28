import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcalFeed } from "@/lib/integrations/calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) return new NextResponse("Missing workspaceId", { status: 400 });

  const supabase = await createClient();
  if (!supabase) return new NextResponse("Not configured", { status: 503 });

  // Verify the caller can at least see the workspace (RLS will filter, but we need a user)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, starts_at, ends_at, track, students ( full_name )")
    .eq("workspace_id", workspaceId)
    .order("starts_at", { ascending: true })
    .limit(200);

  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, starts_at, ends_at")
    .eq("workspace_id", workspaceId)
    .order("starts_at", { ascending: true })
    .limit(200);

  type LessonWithStudent = { id: string; starts_at: string; ends_at: string; students: { full_name: string } | { full_name: string }[] | null };
  const lessonEvents = ((lessons ?? []) as unknown as LessonWithStudent[]).map((l) => {
    const student = Array.isArray(l.students) ? l.students[0] : l.students;
    return {
      id: l.id,
      title: student ? `Lesson: ${student.full_name}` : "Lesson",
      starts_at: l.starts_at,
      ends_at: l.ends_at,
    };
  });

  const calEvents = ((events ?? []) as { id: string; title: string; starts_at: string; ends_at: string }[]).map((e) => ({
    id: e.id,
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
  }));

  const all = [...lessonEvents, ...calEvents];

  const ical = buildIcalFeed({ events: all, calendarName: "Teacher OS" });

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="teacher-os.ics"',
    },
  });
}
