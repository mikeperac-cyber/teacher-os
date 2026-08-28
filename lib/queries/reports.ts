import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WeeklyLessonCount = { weekStart: string; count: number };
export type ProgressTrend = { at: string; value: number };
export type ReportData = {
  totalLessons: number;
  deliveredLessons: number;
  upcomingLessons: number;
  weeklyCounts: WeeklyLessonCount[];
  eslTrends: ProgressTrend[];
  ieltsTrends: ProgressTrend[];
  capacityUtilization: { date: string; lessons: number; capacity: number | null }[];
};

function weekStartIso(d: Date): string {
  const copy = new Date(d);
  const day = copy.getUTCDay(); // 0 Sun
  const diff = copy.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  copy.setUTCDate(diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export async function getReportData(input: {
  workspaceId: string;
  track?: "ESL" | "IELTS" | null;
}): Promise<ReportData> {
  const supabase = await createClient();
  if (!supabase) {
    return { totalLessons: 0, deliveredLessons: 0, upcomingLessons: 0, weeklyCounts: [], eslTrends: [], ieltsTrends: [], capacityUtilization: [] };
  }

  const trackFilter = input.track ? (input.track === "ESL" ? "esl" : "ielts") : null;

  // Lessons in last 12 weeks
  const since = new Date();
  since.setDate(since.getDate() - 84);

  let lessonsQuery = supabase
    .from("lessons")
    .select("id, starts_at, status, track")
    .gte("starts_at", since.toISOString())
    .order("starts_at", { ascending: true });

  if (trackFilter) lessonsQuery = lessonsQuery.eq("track", trackFilter);

  const [lessonsRes, eslRes, ieltsRes, capacitiesRes] = await Promise.all([
    lessonsQuery,
    trackFilter === "ielts"
      ? Promise.resolve({ data: [] })
      : supabase.from("esl_progress_entries").select("recorded_at, overall").order("recorded_at", { ascending: true }).limit(100),
    trackFilter === "esl"
      ? Promise.resolve({ data: [] })
      : supabase.from("ielts_skill_scores").select("recorded_at, band").order("recorded_at", { ascending: true }).limit(100),
    supabase.from("day_capacities").select("day, capacity").gte("day", since.toISOString().slice(0, 10)),
  ]);

  const lessons = (lessonsRes.data ?? []) as { starts_at: string; status: string; track: string }[];
  const totalLessons = lessons.length;
  const deliveredLessons = lessons.filter((l) => l.status === "delivered").length;
  const upcomingLessons = lessons.filter((l) => l.status === "scheduled").length;

  // Weekly buckets
  const buckets = new Map<string, number>();
  for (const l of lessons) {
    const ws = weekStartIso(new Date(l.starts_at));
    buckets.set(ws, (buckets.get(ws) ?? 0) + 1);
  }
  const weeklyCounts: WeeklyLessonCount[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, count]) => ({ weekStart, count }));

  const eslTrends: ProgressTrend[] = ((eslRes.data ?? []) as { recorded_at: string; overall: number | null }[])
    .filter((r) => r.overall !== null)
    .map((r) => ({ at: r.recorded_at, value: r.overall as number }));

  // IELTS average band per day (group by date)
  const ieltsRaw = (ieltsRes.data ?? []) as { recorded_at: string; band: number }[];
  const ieltsByDay = new Map<string, number[]>();
  for (const r of ieltsRaw) {
    const day = r.recorded_at.slice(0, 10);
    const arr = ieltsByDay.get(day) ?? [];
    arr.push(r.band);
    ieltsByDay.set(day, arr);
  }
  const ieltsTrends: ProgressTrend[] = Array.from(ieltsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, bands]) => ({ at: day, value: Math.round((bands.reduce((s, b) => s + b, 0) / bands.length) * 10) / 10 }));

  // Capacity utilization per day (lessons vs capacity)
  const capMap = new Map<string, number>();
  for (const c of (capacitiesRes.data ?? []) as { day: string; capacity: number }[]) capMap.set(c.day, c.capacity);
  const lessonsByDay = new Map<string, number>();
  for (const l of lessons) {
    const day = l.starts_at.slice(0, 10);
    lessonsByDay.set(day, (lessonsByDay.get(day) ?? 0) + 1);
  }
  const capacityUtilization = Array.from(lessonsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, lessons: count, capacity: capMap.get(date) ?? null }));

  return { totalLessons, deliveredLessons, upcomingLessons, weeklyCounts, eslTrends, ieltsTrends, capacityUtilization };
}
