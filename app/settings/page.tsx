import type { ReactNode } from "react";
import { connection } from "next/server";
import {
  CalendarSync,
  Globe,
  Mail,
  MessageCircle,
  User,
} from "lucide-react";

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
import { discordConfigured } from "@/features/discord/config";
import { getMyDiscordConnection } from "@/features/discord/data";
import { disconnectDiscordAction } from "@/features/discord/actions";
import { DiscordConnectForm } from "@/features/discord/components/discord-connect";

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
  too_many_calendars: "Select at most three calendars. Nothing was synced; please reduce your selection.",
  invalid_google_data: "Google returned incomplete or invalid event data. Existing imported events were preserved. Please retry.",
  sync_busy: "Another sync is running or has replaced this attempt. Please wait, then retry. No older snapshot was written.",
  connection_changed: "Your Google connection changed or was disconnected. Reload Settings before syncing again.",
  sync_truncated: "Google returned more than the safe event limit. Existing imported events were preserved.",
  sync_failed: "Google Calendar sync failed. Existing imported events were left unchanged.",
  synced: "Google Calendar sync completed successfully.",
  push_done: "All Asteria events are mirrored to your Google calendar.",
  push_partial: "Some Asteria events could not be pushed to Google. Check the connection, then retry.",
  push_readonly: "This connection is read-only. Reconnect Google Calendar to enable pushing events.",
};

const googleSuccessCodes = new Set(["connected", "disconnected", "calendars_loaded", "synced", "push_done"]);

function StatusPill({ tone, children }: { tone: "green" | "amber" | "gray"; children: ReactNode }) {
  const dot = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-muted-foreground/40";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

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
  const discordConnection = discordConfigured() ? await getMyDiscordConnection() : null;
  const googleMessage =
    typeof google === "string" && Object.hasOwn(googleMessages, google)
      ? googleMessages[google]
      : null;

  const banner =
    status === "saved"
      ? { kind: "status" as const, text: "Profile updated successfully!" }
      : googleMessage
        ? {
            kind: (google && googleSuccessCodes.has(google) ? "status" : "alert") as "status" | "alert",
            text: googleMessage,
          }
        : error
          ? { kind: "alert" as const, text: "Invalid input. Please check your information." }
          : null;

  return (
    <AppShell activePage="settings">
      <div className="space-y-6">
        {/* HEADER */}
        <header className="rounded-3xl border bg-card p-6 sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Personalize your Asteria experience and manage your integrations.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              <span className="max-w-56 truncate">{user.email ?? "No email"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5">
              <Globe className="size-3.5" aria-hidden="true" />
              {profile.timezone}
            </span>
          </div>
        </header>

        {banner && (
          <p
            role={banner.kind}
            className={`rounded-xl border p-4 text-sm ${
              banner.kind === "status"
                ? "border-emerald-600/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                : "border-red-600/30 bg-red-500/5 text-red-600 dark:text-red-400"
            }`}
          >
            {banner.text}
          </p>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* PROFILE */}
          <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader>
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <User className="size-5 text-primary" aria-hidden="true" />
              </div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your display name and timezone.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateMyProfile} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      readOnly
                      value={user.email ?? ""}
                      className="min-h-12 w-full rounded-xl border bg-muted pl-10 pr-4 text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Managed by Supabase Authentication.</p>
                </div>

                <div>
                  <label htmlFor="displayName" className="mb-2 block text-sm font-medium">Display Name</label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    maxLength={80}
                    defaultValue={profile.displayName ?? ""}
                    placeholder="Your name"
                    className="min-h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label htmlFor="timezone" className="mb-2 block text-sm font-medium">Timezone</label>
                  <div className="relative">
                    <Globe aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="timezone"
                      name="timezone"
                      defaultValue={profile.timezone}
                      className="min-h-12 w-full appearance-none rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="Asia/Jakarta">WIB · Jakarta (UTC+7)</option>
                      <option value="Asia/Makassar">WITA · Makassar (UTC+8)</option>
                      <option value="Asia/Jayapura">WIT · Jayapura (UTC+9)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" className="rounded-full px-6">Save Changes</Button>
              </form>
            </CardContent>
          </Card>

          {/* INTEGRATIONS */}
          <div className="space-y-4">
            <Card className="transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10">
                      <CalendarSync className="size-5 text-sky-500" aria-hidden="true" />
                    </span>
                    <div>
                      <CardTitle>Google Calendar</CardTitle>
                      <CardDescription>
                        Import read-only calendars and mirror your events to a dedicated
                        Asteria calendar in Google.
                      </CardDescription>
                    </div>
                  </div>
                  {googleConnection ? (
                    <StatusPill tone={googleTwoWay ? "green" : "amber"}>
                      {googleTwoWay ? "Two-way sync" : "Read-only"}
                    </StatusPill>
                  ) : (
                    <StatusPill tone={canConnectGoogle ? "gray" : "amber"}>
                      {canConnectGoogle ? "Not connected" : "Not configured"}
                    </StatusPill>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {googleConnection ? (
                  <>
                    <p className="text-sm">
                      Connected to <strong>{googleConnection.googleEmail ?? "Google account"}</strong>.
                    </p>
                    {googleTwoWay ? (
                      <div className="space-y-3 rounded-2xl border bg-muted/40 p-4 text-sm">
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
                      Imported events are read-only in Asteria. Disconnecting removes Asteria&apos;s
                      local connection, imported mirrors, and sync markers, not your Google events.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <form action={loadGoogleCalendars}>
                        <Button type="submit" variant="outline">Load Google Calendars</Button>
                      </form>
                      <form action={disconnectGoogleCalendar}>
                        <Button
                          type="submit"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Disconnect
                        </Button>
                      </form>
                    </div>
                    {googleSources.length > 0 && <GoogleCalendarSyncForm sources={googleSources} />}
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
                      <Button type="submit" disabled={!canConnectGoogle} className="rounded-full px-6">
                        Connect Google Calendar
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                      <MessageCircle className="size-5 text-indigo-500" aria-hidden="true" />
                    </span>
                    <div>
                      <CardTitle>Discord</CardTitle>
                      <CardDescription>
                        Chat with Asteria bot from Discord and receive your reminders:
                        upcoming events, deadlines, overdue tasks, and your daily plan.
                      </CardDescription>
                    </div>
                  </div>
                  <StatusPill
                    tone={!discordConfigured() ? "amber" : discordConnection ? "green" : "gray"}
                  >
                    {!discordConfigured() ? "Bot not configured" : discordConnection ? "Linked" : "Not linked"}
                  </StatusPill>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!discordConfigured() ? (
                  <p className="text-sm text-muted-foreground">
                    The bot is not configured on this server. Set DISCORD_BOT_TOKEN
                    and DISCORD_INTERNAL_SECRET in .env.local, run{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run bot</code>,
                    then reload this page.
                  </p>
                ) : discordConnection ? (
                  <>
                    <p className="text-sm">
                      Linked to <strong>{discordConnection.discordUsername}</strong> on Discord.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reminders are sent to your Discord DMs. Disconnecting removes
                      the link, not your Asteria data.
                    </p>
                    <form action={disconnectDiscordAction}>
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Disconnect
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Generate a one-time code, then send it to the bot in a
                      Discord direct message to link this account.
                    </p>
                    <DiscordConnectForm />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
