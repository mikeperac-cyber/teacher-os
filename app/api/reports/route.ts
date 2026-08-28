import { NextResponse, type NextRequest } from "next/server";
import { getReportData } from "@/lib/queries/reports";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspaceId");
  const track = searchParams.get("track") as "esl" | "ielts" | null;

  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const data = await getReportData({
    workspaceId,
    track: track === "esl" ? "ESL" : track === "ielts" ? "IELTS" : null,
  });

  return NextResponse.json(data);
}
