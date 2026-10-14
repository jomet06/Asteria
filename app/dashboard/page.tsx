
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Verify the current user with Supabase Auth.
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const user = data.user;

  // Ensure this authenticated user has a profile.
  const profile = await prisma.profile.upsert({
    where: {
      id: user.id,
    },
    update: {},
    create: {
      id: user.id,
      displayName:
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    },
  });

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Asteria Dashboard
            </h1>

            <p className="mt-2 text-muted-foreground">
              Welcome, {profile.displayName ?? user.email ?? "User"}!
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border px-4 py-2 font-medium hover:bg-muted"
            >
              Logout
            </button>
          </form>
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
