/**
 * Session refresh and route protection.
 *
 * Named `proxy.ts` because Next.js 16 renamed the `middleware` convention. The
 * behaviour is unchanged: this still runs before the request reaches a route.
 *
 * Two jobs, in order:
 *
 * 1. **Refresh the session.** Supabase access tokens are short-lived. Server
 *    components cannot set cookies, so without a pass here a user would
 *    be silently signed out when their token expired mid-session. This is the
 *    one place in a Next.js app where the rotated cookie can actually be
 *    written, which is why `@supabase/ssr` expects it.
 *
 * 2. **Keep unauthenticated requests off the workspace.** This is a redirect
 *    for the user's benefit, *not* a security control. The real boundary is Row
 *    Level Security in Postgres: even if this file were deleted, an
 *    unauthenticated request would read nothing (see tests/db/rls.test.ts,
 *    "anonymous access"). Treating this file as the boundary is how
 *    applications end up with an authorization check that a direct API call
 *    walks straight past.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Reachable without a session. */
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/auth"];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

export async function proxy(request: NextRequest) {
  // Before a project is provisioned there is no session to refresh and nobody
  // can sign in, so gating routes would lock the interface away entirely.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Written to both: the request so any later read in this same pass
          // sees the new value, and the response so the browser stores it.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token against the auth server. getSession() only
  // decodes whatever cookie was sent, which the client controls, so it must not
  // be used to make an access decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    // Preserve where they were headed, including the ?track/view deep link.
    signIn.search = "";
    signIn.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signIn);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image files.
     *
     * Running on every request is deliberate — the session must be refreshed
     * on navigations, not only on protected pages, or a token can expire while
     * the user sits on a public one.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
