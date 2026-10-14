
export const instant = false;

import Link from "next/link";

import { getMyAccount } from "@/features/profile/data";
import { signOut } from "@/app/auth/actions";

export default async function DashboardPage() {
  const { user, profile } = await getMyAccount();

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Asteria Dashboard
            </h1>

            <p className="mt-2 text-muted-foreground">
              Welcome,{" "}
              {profile.displayName ?? user.email ?? "User"}!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Settings
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border p-6">
            <h2 className="font-semibold">
              Calendar
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No events available yet.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h2 className="font-semibold">
              Tasks
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No tasks available yet.
            </p>
          </div>

          <div className="rounded-xl border p-6">
            <h2 className="font-semibold">
              AI Daily Plan
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your daily plan will appear here.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-xl border p-6">
          <h2 className="text-lg font-semibold">
            Account Information
          </h2>

          <p className="mt-3 text-sm">
            Email: {user.email}
          </p>

          <p className="mt-2 text-sm">
            Timezone: {profile.timezone}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            Profile ID: {profile.id}
          </p>
        </section>
      </div>
    </main>
  );
}
