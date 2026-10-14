
"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { authErrorCode, logAuthFailure } from "@/lib/supabase/auth-errors";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

function readCredentials(formData: FormData, minimumLength = 1) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    password.length < minimumLength
  ) {
    return null;
  }

  return {
    email: normalizedEmail,
    password,
  };
}

export async function signUp(formData: FormData) {
  const credentials = readCredentials(formData, 8);

  if (!credentials) {
    redirect("/register?error=invalid_input");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    logAuthFailure("signup", error);
    redirect(`/register?error=${authErrorCode(error, "signup_failed")}`);
  }

  if (data.session) redirect("/dashboard");
  redirect("/login?status=check_email");
}

export async function signIn(formData: FormData) {
  const credentials = readCredentials(formData);

  if (!credentials) {
    redirect("/login?error=invalid_credentials");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    logAuthFailure("login", error);
    redirect(`/login?error=${authErrorCode(error, "auth_failed")}`);
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/dashboard?error=logout_failed");
  }

  redirect("/login");
}
