/**
 * Email confirmation and magic-link landing.
 *
 * Supabase sends the user here with a one-time `code`. Exchanging it for a
 * session must happen server-side so the session cookie is set on this
 * response — the same reason sign-in is a server action.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Only relative paths, so a crafted link cannot bounce the user off-site
  // carrying a fresh session.
  const nextParam = searchParams.get("next") ?? "/";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing-code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/sign-in?error=unconfigured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Usually an expired or already-used link.
    return NextResponse.redirect(`${origin}/sign-in?error=link-expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
