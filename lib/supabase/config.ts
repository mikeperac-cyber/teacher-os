/**
 * Supabase configuration, and whether there is any.
 *
 * WHY "CONFIGURED" IS A FIRST-CLASS STATE
 * ---------------------------------------
 * No Supabase project exists yet. If the client modules threw on a missing URL,
 * `npm run dev` would fail for anyone who has not provisioned one, and the
 * interface — which is finished and worth looking at — would be unreachable.
 *
 * So an unconfigured environment is a supported state, not a crash. Every
 * server helper returns "no user" and the shell renders exactly as it does
 * today. What must never happen is the app *pretending* to be signed in, so
 * this reports honestly and the UI says so.
 *
 * Once `.env.local` is filled in (see docs/SUPABASE_SETUP.md) everything below
 * lights up with no code change.
 */

/**
 * Read at module scope so Next inlines the public values into the client
 * bundle. `process.env.NEXT_PUBLIC_*` must be referenced literally — a dynamic
 * lookup like `process.env[name]` is not replaced at build time and resolves to
 * undefined in the browser.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** True when both public values are present. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

/**
 * The public credentials.
 *
 * Throws only when something already checked `isSupabaseConfigured` and called
 * anyway — that is a programming error, not a configuration one, and should be
 * loud.
 */
export function requirePublicConfig(): { url: string; publishableKey: string } {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local — see " +
        "docs/SUPABASE_SETUP.md. Guard with isSupabaseConfigured before calling this.",
    );
  }
  return { url, publishableKey };
}

/** Absolute site URL, used to build auth redirect targets. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
