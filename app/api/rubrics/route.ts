import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspaceId");
  const track = searchParams.get("track");

  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ templates: [] });

  let query = supabase
    .from("rubric_templates")
    .select("id, title, kind, track, rubric_criteria ( id, label, sort_order, max_score )")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (track) query = query.eq("track", track);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const templates =
    (data as unknown as { id: string; title: string; kind: string; rubric_criteria: unknown }[])?.map((row) => ({
      id: row.id,
      title: row.title,
      criteria: ((row.rubric_criteria as { id: string; label: string; sort_order: number; max_score: number | null }[]) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order),
    })) ?? [];

  return NextResponse.json({ templates });
}
