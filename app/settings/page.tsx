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
import {
  getMyGoogleCalendarConnection,
  getMyGoogleCalendarSources,
  getMyGooglePushBacklog,
} from "@/features/calendar/google/data";
import { googleCalendarConfigured, hasGoogleWriteScopes } from "@/features/calendar/google/config";
import { disconnectGoogleCalendar } from "@/features/calendar/google/actions";
import {
  loadGoogleCalendars,
  syncPendingEventsToGoogle,
} from "@/features/calendar/google/import-actions";
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
  connected: "Google Calendar connected. Load your calendars to import their events.",
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
  sync_failed: "Google Calendar sync failed. Existing imported events were left unchanged.",
  synced: "Google Calendar sync completed successfully.",
  push_done: "All Asteria events are mirrored to your Google calendar.",
  push_partial: "Some Asteria events could not be pushed to Google. Check the connection, then retry.",
  push_readonly: "This connection is read-only. Reconnect Google Calendar to enable pushing events.",
};

const googleSuccessCodes = new Set(["connected", "disconnected", "calendars_loaded", "synced", "push_done"]);

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  // Ensure request-time rendering before authentication and token-related APIs.
  await connection();

  const { status, error, google } = await searchParams;
  const { user, profile } = await getMyAccount();
  const googleConnection = await getMyGoogleCalendarConnection();
  const googleSources = googleConnection ? await getMyGoogleCalendarSources() : [];
  const googlePushBacklog = googleConnection ? await getMyGooglePushBacklog() : 0;
  const googleTwoWay = googleConnection
    ? hasGoogleWriteScopes(googleConnection.grantedScopes)
    : false;
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
              Imported calendars stay read-only; your own events mirror to a
              dedicated Asteria calendar in Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleMessage && (
              <p role={google && googleSuccessCodes.has(google) ? "status" : "alert"}
                className="rounded-lg border p-3 text-sm">
                {googleMessage}
              </p>
            )}
            {googleConnection ? (
              <>
                <p className="text-sm">
                  Connected to <strong>{googleConnection.googleEmail ?? "Google account"}</strong>.
                </p>
                {googleTwoWay ? (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
                    <p>
                      Two-way sync is on. Events you create or edit in Asteria are
                      mirrored to the <strong>Asteria</strong> calendar in your
                      Google account.
                    </p>
                    {!googleConnection.targetCalendarId && (
                      <p className="text-xs text-muted-foreground">
                        The Asteria calendar will be created in Google on the first push.
                      </p>
                    )}
                    {googlePushBacklog > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {googlePushBacklog} event{googlePushBacklog === 1 ? " is" : "s are"} waiting to be pushed to Google.
                        </p>
                        <form action={syncPendingEventsToGoogle}>
                          <Button type="submit" variant="outline" size="sm">
                            Sync to Google
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This connection is read-only. Reconnect Google Calendar to also
                    mirror your Asteria events to a dedicated Asteria calendar.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Imported events are read-only in Asteria and recurring events stay
                  local for now. Disconnecting removes Asteria&apos;s local connection,
                  imported mirrors, and sync markers — not your Google events.
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
