
export const instant = false;
import Link from "next/link";

import {
  signIn,
  signInWithGoogle,
} from "@/app/auth/actions";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-bold">
          Welcome Back
        </h1>

        <p className="mt-2 text-muted-foreground">
          Sign in to your Asteria account.
        </p>

        {status === "check_email" && (
          <p role="status" className="mt-5 rounded-lg bg-blue-100 p-3 text-sm text-blue-800">
            If your account needs confirmation, check your inbox and spam folder for a link. An accepted request does not guarantee email delivery. Open the latest link in this browser.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {authErrorMessage(error)}
          </p>
        )}

        <form action={signIn} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>

        <form action={signInWithGoogle} className="mt-4">
          <button
            type="submit"
            className="w-full rounded-lg border px-4 py-3 font-medium hover:bg-muted"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-500 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
