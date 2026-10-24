import { google, type calendar_v3 } from "googleapis";

import { getGoogleOAuthConfig } from "./config";
import { decryptGoogleRefreshToken } from "./crypto";

export type NormalizedGoogleEvent = {
  googleEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  isAllDay: boolean;
  htmlLink: string | null;
  googleUpdatedAt: Date | null;
};

function oauthClient(refreshToken: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export async function getCalendarClient(encryptedRefreshToken: string) {
  const client = oauthClient(decryptGoogleRefreshToken(encryptedRefreshToken));
  await client.getAccessToken();
  return google.calendar({ version: "v3", auth: client });
}

export async function listGoogleCalendars(api: calendar_v3.Calendar) {
  const calendars: calendar_v3.Schema$CalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const response = await api.calendarList.list({ maxResults: 250, pageToken, showDeleted: false });
    calendars.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return calendars.filter((item) => typeof item.id === "string" && typeof item.summary === "string");
}

function eventDate(value: string | null | undefined, fallback: string): Date {
  const parsed = new Date(value ?? fallback);
  if (Number.isNaN(parsed.getTime())) throw new Error("Google returned an invalid event date.");
  return parsed;
}

export async function listGoogleEvents(
  api: calendar_v3.Calendar,
  calendarId: string,
  from: Date,
  to: Date,
  maxEvents = 2500,
) {
  const result: NormalizedGoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const response = await api.events.list({
      calendarId,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: true,
      maxResults: Math.min(250, maxEvents - result.length),
      pageToken,
    });
    for (const item of response.data.items ?? []) {
      if (!item.id) continue;
      if (item.status === "cancelled") continue;
      const allDay = Boolean(item.start?.date && item.end?.date);
      const startsAt = allDay
        ? eventDate(item.start?.date, from.toISOString())
        : eventDate(item.start?.dateTime, from.toISOString());
      const endsAt = allDay
        ? eventDate(item.end?.date, to.toISOString())
        : eventDate(item.end?.dateTime, to.toISOString());
      result.push({
        googleEventId: item.id,
        title: item.summary?.trim() || "(Untitled event)",
        description: item.description ?? null,
        location: item.location ?? null,
        startsAt,
        endsAt,
        timezone: item.start?.timeZone ?? item.end?.timeZone ?? "UTC",
        isAllDay: allDay,
        htmlLink: item.htmlLink ?? null,
        googleUpdatedAt: item.updated ? new Date(item.updated) : null,
      });
      if (result.length >= maxEvents) return { events: result, truncated: Boolean(response.data.nextPageToken) };
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return { events: result, truncated: false };
}

