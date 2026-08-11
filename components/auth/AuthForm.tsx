"use client";

/**
 * Sign-in and sign-up form.
 *
 * Built from the existing design system — `.primary-button`, the modal field
 * styles, the same greys — so authentication reads as part of the product
 * rather than a bolted-on gate.
 *
 * Uses `useActionState`, so the form works before hydration: the browser posts
 * it natively and the server action runs either way.
 */

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";

import { signInAction, signUpAction } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE, type AuthFormState } from "@/lib/types/auth";

type Mode = "sign-in" | "sign-up";

const COPY: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    submit: string;
    submitting: string;
    switchPrompt: string;
    switchLabel: string;
    switchHref: string;
  }
> = {
  "sign-in": {
    title: "Sign in to Teacher OS",
    subtitle: "Your ESL and IELTS Academic workspaces.",
    submit: "Sign in",
    submitting: "Signing in…",
    switchPrompt: "No account yet?",
    switchLabel: "Create one",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "You will be added to a workspace by its owner.",
    submit: "Create account",
    submitting: "Creating…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
};

export function AuthForm({
  mode,
  next,
  configured,
  initialError,
}: {
  mode: Mode;
  next: string;
  configured: boolean;
  initialError?: string;
}) {
  const action = mode === "sign-in" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    initialError
      ? { error: initialError, notice: null }
      : EMPTY_AUTH_STATE,
  );

  const copy = COPY[mode];

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="brand-mark">
          <GraduationCap size={19} strokeWidth={2.2} />
        </span>
        <span className="brand-copy">
          <strong>Teacher</strong>
          <em>OS</em>
        </span>
      </div>

      <h1>{copy.title}</h1>
      <p className="auth-subtitle">{copy.subtitle}</p>

      {/* Stated up front rather than after a failed attempt: before a project
          is provisioned there is no account to sign in to, and letting someone
          type credentials into a form that cannot work is a waste of their
          time. */}
      {!configured && (
        <p className="auth-banner" role="status">
          <AlertCircle size={15} />
          <span>
            No database is connected yet, so accounts do not exist. See{" "}
            <code>docs/SUPABASE_SETUP.md</code>.
          </span>
        </p>
      )}

      <form action={formAction} className="auth-form" noValidate>
        <input type="hidden" name="next" value={next} />

        {mode === "sign-up" && (
          <label>
            <span>Your name</span>
            <input
              name="displayName"
              autoComplete="name"
              placeholder="How you want to appear"
            />
          </label>
        )}

        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "sign-up" ? 8 : undefined}
            placeholder={mode === "sign-up" ? "At least 8 characters" : ""}
          />
        </label>

        {state.error && (
          <p className="auth-message is-error" role="alert">
            <AlertCircle size={15} />
            <span>{state.error}</span>
          </p>
        )}

        {state.notice && (
          <p className="auth-message is-notice" role="status">
            <CheckCircle2 size={15} />
            <span>{state.notice}</span>
          </p>
        )}

        <button className="primary-button auth-submit" type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={15} className="spin" /> {copy.submitting}
            </>
          ) : (
            copy.submit
          )}
        </button>
      </form>

      <p className="auth-switch">
        {copy.switchPrompt} <Link href={copy.switchHref}>{copy.switchLabel}</Link>
      </p>
    </div>
  );
}
