import { connection } from "next/server";

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
import { getMyGoogleCalendarConnection, getMyGoogleCalendarSources } from "@/features/calendar/google/data";
import { googleCalendarConfigured } from "@/features/calendar/google/config";
import { disconnectGoogleCalendar } from "@/features/calendar/google/actions";
import { loadGoogleCalendars } from "@/features/calendar/google/import-actions";
import { GoogleCalendarSyncForm } from "@/features/calendar/google/google-calendar-sync-form";

export const instant = false;

type SettingsPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
    google?: string;
  }>;
};

const googleMessages: Record<string, string> = {
  connected: "Google Calendar connected. Event import will be available in M3.7.2.",
  disconnected: "Google Calendar disconnected from Asteria.",
  cancelled: "Google Calendar authorization was cancelled.",
  invalid_state: "The Google connection request expired or was invalid. Please retry.",
  session_expired: "Your login session expired. Sign in and connect again.",
  oauth_error: "Google authorization failed. Check the OAuth client and permissions, then retry.",
  refresh_required: "Google did not provide an offline refresh token. Reconnect and allow access.",
  config_error: "Google Calendar OAuth configuration is missing or invalid.",
  calendars_loaded: "Google calendars loaded. Select up to three calendars and sync them.",
  no_calendars_selected: "Select at least one calendar before syncing.",
  invalid_calendars: "One or more selected calendars are no longer available.",
  sync_truncated: "Google returned more than the safe event limit. Existing imported events were preserved.",
  synced: "Google Calendar sync completed successfully.",
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  // Ensure request-time rendering before authentication and token-related APIs.
  await connection();

  const { status, error, google } = await searchParams;
  const { user, profile } = await getMyAccount();
  const googleConnection = await getMyGoogleCalendarConnection();
  const googleSources = googleConnection ? await getMyGoogleCalendarSources() : [];
  const canConnectGoogle = googleCalendarConfigured();
  const googleMessage =
    typeof google === "string" && Object.hasOwn(googleMessages, google)
      ? googleMessages[google]
      : null;

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

      <div className="space-y-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Manage your display name and timezone.</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "saved" && (
              <p role="status" className="mb-6 rounded-lg border border-green-600/30 p-4 text-sm text-green-600">
                Profile updated successfully!
              </p>
            )}
            {error && (
              <p role="alert" className="mb-6 rounded-lg border border-red-600/30 p-4 text-sm text-red-600">
                Invalid input. Please check your information.
              </p>
            )}
            <form action={updateMyProfile} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium">Email</label>
                <input id="email" type="email" readOnly value={user.email ?? ""} className="mt-2 w-full rounded-lg border bg-muted px-4 py-3 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">Managed by Supabase Authentication.</p>
              </div>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium">Display Name</label>
                <input id="displayName" name="displayName" type="text" maxLength={80} defaultValue={profile.displayName ?? ""} className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium">Timezone</label>
                <select id="timezone" name="timezone" defaultValue={profile.timezone} className="mt-2 w-full rounded-lg border bg-background px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Asia/Jakarta">WIB — Jakarta (UTC+7)</option>
                  <option value="Asia/Makassar">WITA — Makassar (UTC+8)</option>
                  <option value="Asia/Jayapura">WIT — Jayapura (UTC+9)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <Button type="submit" size="lg">Save Changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>
              Connect a Google account separately from your Asteria login.
              This step requests read-only Calendar access; syncing events comes next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleMessage && (
              <p role={google === "connected" || google === "disconnected" ? "status" : "alert"}
                className="rounded-lg border p-3 text-sm">
                {googleMessage}
              </p>
            )}
            {googleConnection ? (
              <>
                <p className="text-sm">
                  Connected to <strong>{googleConnection.googleEmail ?? "Google account"}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Imported events are read-only in Asteria. Disconnecting removes
                  Asteria&apos;s local connection and imported mirrors, not your Google events.
                </p>
                <form action={loadGoogleCalendars}>
                  <Button type="submit" variant="outline">Load Google Calendars</Button>
                </form>
                {googleSources.length > 0 && <GoogleCalendarSyncForm sources={googleSources} />}
                <form action={disconnectGoogleCalendar}>
                  <Button type="submit" variant="outline">Disconnect Google Calendar</Button>
                </form>
              </>
            ) : (
              <>
                {!canConnectGoogle && (
                  <p className="text-sm text-muted-foreground">
                    Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                    GOOGLE_REDIRECT_URI and GOOGLE_TOKEN_ENCRYPTION_KEY
                    in .env.local, then restart the app.
                  </p>
                )}
                <form action="/api/integrations/google/connect" method="post">
                  <Button type="submit" disabled={!canConnectGoogle}>
                    Connect Google Calendar
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
