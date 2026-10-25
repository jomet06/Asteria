import { google, type calendar_v3 } from "googleapis";

import { getGoogleOAuthConfig } from "./config";
import { decryptGoogleRefreshToken } from "./crypto";
import { GoogleImportError, normalizeGoogleEvent, readGooglePage, type NormalizedGoogleEvent } from "./import-validation";
export type { NormalizedGoogleEvent } from "./import-validation";

function oauthClient(refreshToken: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.transporter.defaults = { ...client.transporter.defaults, timeout: 15_000, retry: false };
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

export async function listGoogleEvents(
  api: calendar_v3.Calendar,
  calendarId: string,
  from: Date,
  to: Date,
  maxEvents = 2500,
) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 2500 ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    throw new GoogleImportError("invalid_google_data");
  }
  const result = new Map<string, NormalizedGoogleEvent>();
  const seenPages = new Set<string>();
  let received = 0;
  let pageToken: string | undefined;
  do {
    const response = await api.events.list({
      calendarId,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: true,
      maxResults: Math.min(250, maxEvents - received),
      pageToken,
    }, { timeout: 15_000, retry: false });
    const page = readGooglePage(response.data);
    received += page.items.length;
    if (received > maxEvents || (received === maxEvents && page.nextPageToken)) {
      return { events: [], truncated: true };
    }
    for (const item of page.items) {
      const event = normalizeGoogleEvent(item);
      if (!event) continue;
      if (result.has(event.googleEventId)) throw new GoogleImportError("invalid_google_data");
      result.set(event.googleEventId, event);
    }
    pageToken = page.nextPageToken;
    if (pageToken) {
      if (seenPages.has(pageToken) || seenPages.size >= 100) throw new GoogleImportError("invalid_google_data");
      seenPages.add(pageToken);
    }
  } while (pageToken);
  return { events: [...result.values()], truncated: false };
}

