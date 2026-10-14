
"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

function readCredentials(formData: FormData) {
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
    !normalizedEmail.includes("@") ||
    password.length < 8
  ) {
    return null;
  }

  return {
    email: normalizedEmail,
    password,
  };
}

export async function signUp(formData: FormData) {
  const credentials = readCredentials(formData);

  if (!credentials) {
    redirect("/register?error=invalid_input");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect("/register?error=signup_failed");
  }

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
    redirect("/login?error=invalid_credentials");
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

  await supabase.auth.signOut();

  redirect("/login");
}
