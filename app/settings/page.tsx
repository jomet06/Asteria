
export const instant = false;

import Link from "next/link";

import { getMyAccount } from "@/features/profile/data";
import { updateMyProfile } from "@/features/profile/actions";

type SettingsPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { status, error } = await searchParams;

  const { user, profile } = await getMyAccount();

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Dashboard
        </Link>

        <div className="mt-8">
          <h1 className="text-3xl font-bold">
            Profile Settings
          </h1>

          <p className="mt-2 text-muted-foreground">
            Manage your personal Asteria profile.
          </p>
        </div>

        {status === "saved" && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-green-600/30 p-4 text-sm text-green-600"
          >
            Profile updated successfully!
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-600/30 p-4 text-sm text-red-600"
          >
            Invalid input. Please check your information.
          </p>
        )}

        <form
          action={updateMyProfile}
          className="mt-8 space-y-6 rounded-xl border p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={user.email ?? ""}
              readOnly
              className="mt-2 w-full rounded-lg border bg-muted px-4 py-3 text-muted-foreground"
            />

            <p className="mt-2 text-xs text-muted-foreground">
              Your email is managed by Supabase Auth.
            </p>
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium"
            >
              Display Name
            </label>

            <input
              id="displayName"
              name="displayName"
              type="text"
              maxLength={80}
              defaultValue={profile.displayName ?? ""}
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="block text-sm font-medium"
            >
              Timezone
            </label>

            <select
              id="timezone"
              name="timezone"
              defaultValue={profile.timezone}
              className="mt-2 w-full rounded-lg border bg-background px-4 py-3"
            >
              <option value="Asia/Jakarta">
                WIB — Jakarta (UTC+7)
              </option>

              <option value="Asia/Makassar">
                WITA — Makassar (UTC+8)
              </option>

              <option value="Asia/Jayapura">
                WIT — Jayapura (UTC+9)
              </option>

              <option value="UTC">
                UTC
              </option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
        </form>
      </div>
    </main>
  );
}
