import "server-only";

/**
 * Supabase client for server components, route handlers and server actions.
 *
 * This client acts *as the signed-in user*, so every query it runs is subject
 * to Row Level Security. That is the point: authorization lives in Postgres,
 * and server code does not get to opt out of it.
 *
 * For the deliberate exception, see `./admin.ts`.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured, requirePublicConfig } from "./config";

/**
 * A request-scoped client, or null when Supabase is not configured.
 *
 * Returning null rather than throwing keeps the application runnable before a
 * project exists. Callers treat null as "nobody is signed in", which is true.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const { url, publishableKey } = requirePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. That is expected and safe:
          // `proxy.ts` refreshes the session on every request, so a token
          // rotated during a render is persisted there instead.
        }
      },
    },
  });
}
