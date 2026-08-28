import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    supabase: isSupabaseConfigured ? "configured" : "not-configured",
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
