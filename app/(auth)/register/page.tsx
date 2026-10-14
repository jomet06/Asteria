
import Link from "next/link";

import { signUp } from "@/app/auth/actions";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-bold">
          Create an Account
        </h1>

        <p className="mt-2 text-muted-foreground">
          Start your journey with Asteria.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error === "invalid_input"
              ? "Enter a valid email and a password of at least 8 characters."
              : "Registration failed. Please try again."}
          </p>
        )}

        <form action={signUp} className="mt-8 space-y-5">
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
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
              placeholder="Minimum 8 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
