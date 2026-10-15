
import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

import { signUp } from "@/app/auth/actions";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

export const instant = false;

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Create an Account"
      description="Start organizing your life with Asteria."
    >
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm"
        >
          {authErrorMessage(error)}
        </p>
      )}

      <form action={signUp} className="space-y-5">
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
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Minimum 8 characters"
            className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <p className="mt-2 text-xs text-muted-foreground">
            Use a strong, unique password.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
        >
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
