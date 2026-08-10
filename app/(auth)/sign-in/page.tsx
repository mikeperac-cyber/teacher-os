import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in · Teacher OS" };

/** Errors the auth callback can bounce back here. */
const CALLBACK_ERRORS: Record<string, string> = {
  "link-expired":
    "That confirmation link has expired or was already used. Try signing in, or create the account again.",
  "missing-code": "That link was incomplete. Request a new one.",
  unconfigured:
    "No database is connected yet, so the link could not be verified.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";

  return (
    <AuthForm
      mode="sign-in"
      next={next}
      configured={isSupabaseConfigured}
      initialError={params.error ? CALLBACK_ERRORS[params.error] : undefined}
    />
  );
}
