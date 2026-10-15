
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMyAccount } from "@/features/profile/data";
import { updateMyProfile } from "@/features/profile/actions";

export const instant = false;

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
    <AppShell activePage="settings">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Profile Settings
        </h1>

        <p className="mt-2 text-muted-foreground">
          Personalize your Asteria experience.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            Personal Information
          </CardTitle>

          <CardDescription>
            Manage your display name and timezone.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === "saved" && (
            <p
              role="status"
              className="mb-6 rounded-lg border border-green-600/30 p-4 text-sm text-green-600"
            >
              Profile updated successfully!
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-red-600/30 p-4 text-sm text-red-600"
            >
              Invalid input. Please check your information.
            </p>
          )}

          <form
            action={updateMyProfile}
            className="space-y-6"
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
                readOnly
                value={user.email ?? ""}
                className="mt-2 w-full rounded-lg border bg-muted px-4 py-3 text-muted-foreground"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Managed by Supabase Authentication.
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
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Your name"
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
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            <Button type="submit" size="lg">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
