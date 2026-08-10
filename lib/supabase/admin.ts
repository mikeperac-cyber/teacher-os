import "server-only";

/**
 * Service-role client. Read this before using it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS CLIENT BYPASSES EVERY ROW LEVEL SECURITY POLICY IN THIS REPOSITORY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It can read and write every learner's records in every workspace. The entire
 * authorization model in `supabase/migrations/` does not apply to it.
 *
 * WHEN NOT TO USE IT — which is almost always
 * -------------------------------------------
 * Not to "make a query work". If a query returns nothing under the normal
 * client, the policies are saying no, and the fix is either the policy or the
 * query — not escalating past both. Reaching for this because RLS is
 * inconvenient converts a tested boundary into an untested one.
 *
 * Never in anything reachable from a request whose input decides which rows it
 * touches.
 *
 * WHEN IT IS LEGITIMATE
 * ---------------------
 * Operations that have no user to act as, and whose scope is fixed in code:
 *
 *   - administrative user management through `auth.admin`
 *   - scheduled maintenance with no request context
 *   - one-off backfills during a migration
 *
 * `import "server-only"` above makes the build fail if this module is ever
 * pulled into a client component, so the key cannot reach a browser bundle by
 * accident.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, requirePublicConfig } from "./config";

/**
 * Builds a service-role client.
 *
 * Takes a `reason` so every call site has to state, in code, why it needs to
 * bypass authorization. It is recorded on the client for tracing and makes an
 * unjustified use obvious in review — a reviewer seeing
 * `createAdminClient("just needed the data")` knows to push back.
 */
export function createAdminClient(reason: string) {
  if (!reason?.trim()) {
    throw new Error(
      "createAdminClient requires a reason. If you cannot state why this " +
        "operation must bypass Row Level Security, use createClient() from " +
        "./server.ts instead.",
    );
  }

  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured; the service-role client is unavailable.",
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is server-only and must never " +
        "be exposed as a NEXT_PUBLIC_* variable.",
    );
  }

  const { url } = requirePublicConfig();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No user session: this client is not acting on anyone's behalf, and
      // persisting or refreshing a session would be meaningless here.
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { "x-teacher-os-admin-reason": reason },
    },
  });
}
