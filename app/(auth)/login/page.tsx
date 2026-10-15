
import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

import {
  signIn,
  signInWithGoogle,
} from "@/app/auth/actions";

import { authErrorMessage } from "@/lib/supabase/auth-errors";

export const instant = false;

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error, status } = await searchParams;

  return (
    <AuthShell
      title="Welcome Back"
      description="Sign in to your Asteria account."
    >
      {status === "check_email" && (
        <p
          role="status"
          className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm"
        >
          If your account requires confirmation,
          please check your inbox and spam folder.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm"
        >
          {authErrorMessage(error)}
        </p>
      )}

      <form action={signIn} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium"
          >
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium"
          >
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
        >
          Sign In
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />

        <span className="text-xs text-muted-foreground">
          OR
        </span>

        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full"
        >
          Continue with Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Create Account
        </Link>
      </p>
    </AuthShell>
  );
}
