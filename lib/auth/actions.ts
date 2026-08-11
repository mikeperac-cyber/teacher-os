"use server";

/**
 * Sign in, sign up, sign out.
 *
 * Server actions rather than a client calling Supabase directly, so the session
 * cookie is set by the server on the same response that performs the
 * navigation. A client-side sign-in would set the cookie in the browser and the
 * next server render could still see the old session.
 *
 * ON ERROR MESSAGES
 * -----------------
 * Sign-in failures are reported with one message regardless of cause. Saying
 * "no account with that email" tells an attacker which addresses are
 * registered, and this application's users are identifiable private tutors and
 * their students.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { siteUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/types/auth";

const MIN_PASSWORD_LENGTH = 8;

const NOT_CONFIGURED =
  "No database is connected yet, so accounts do not exist. See docs/SUPABASE_SETUP.md.";

/** Rejects anything that is not a relative path, to prevent open redirects. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(formData.get("next")),
  };
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, next } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }

  const supabase = await createClient();
  if (!supabase) return { error: NOT_CONFIGURED, notice: null };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately uniform — see the note at the top of this file.
    return {
      error: "That email and password combination was not recognised.",
      notice: null,
    };
  }

  revalidatePath("/", "layout");
  // Outside any try/catch: redirect() signals by throwing, and catching it
  // would turn a successful sign-in into an error.
  redirect(next);
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !password) {
    return { error: "Enter your email and a password.", notice: null };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      notice: null,
    };
  }

  const supabase = await createClient();
  if (!supabase) return { error: NOT_CONFIGURED, notice: null };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to populate profiles.display_name.
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message, notice: null };
  }

  // Not a redirect: with email confirmation on there is no session yet. Worded
  // so it does not reveal whether the address was already registered.
  return {
    error: null,
    notice:
      "Check your email for a confirmation link. You can close this page once it is confirmed.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
