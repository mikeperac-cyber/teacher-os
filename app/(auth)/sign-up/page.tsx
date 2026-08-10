import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Create an account · Teacher OS" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" next="/" configured={isSupabaseConfigured} />;
}
