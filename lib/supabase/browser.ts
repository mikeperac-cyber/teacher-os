"use client";

/**
 * Supabase client for the browser.
 *
 * Uses the publishable key, which is safe to ship: it grants nothing on its own
 * because every table is protected by Row Level Security. The security boundary
 * is the policy set, not the secrecy of this key.
 */

import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured, requirePublicConfig } from "./config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/**
 * The browser client, or null when Supabase is not configured.
 *
 * Cached because each instance opens its own auth listener, and several per
 * page would fight over token refresh.
 */
export function getBrowserClient() {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;

  const { url, publishableKey } = requirePublicConfig();
  cached = createBrowserClient(url, publishableKey);
  return cached;
}
