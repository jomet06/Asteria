import type { calendar_v3 } from "googleapis";

import { prisma } from "@/lib/prisma";
import { hasGoogleWriteScopes } from "./config";
import { getCalendarClient } from "./calendar-api";
import { readCalendarTimezone, formatCalendarLocal } from "../date-time";

// All pushed events live in one dedicated secondary calendar so the
// user's personal Google calendars are never modified by Asteria.
const TARGET_CALENDAR_SUMMARY = "Asteria";
const MAX_RETRY_BATCH = 100;

type SyncableConnection = {
  ownerId: string;
  refreshTokenEncrypted: string;
  grantedScopes: string;
  targetCalendarId: string | null;
};

type PushableEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  isAllDay: boolean;
  googleEventId: string | null;
};

export type GooglePushResult =
  | { ok: true; googleEventId: string }
  | { ok: false; error: string };

export type GoogleDeleteResult = { ok: true } | { ok: false; error: string };

export type RetryPushSummary = {
  attempted: number;
  pushed: number;
  failed: number;
  skipped: boolean;
};

function googleStatus(error: unknown): number | null {
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate?.status === "number") return candidate.status;
  if (typeof candidate?.code === "number") return candidate.code;
  if (typeof candidate?.code === "string" && /^\d{3}$/.test(candidate.code)) {
    return Number(candidate.code);
  }
  return null;
}

// Keep messages generic: never persist Google API response bodies.
function pushErrorMessage(error: unknown): string {
  const status = googleStatus(error);
  if (status === 401 || status === 403) {
    return "Google rejected the request. Reconnect Google Calendar in Settings.";
  }
  if (status === 429) return "Google rate limit reached. Sync again later.";
  return "Google Calendar request failed.";
}

/** Reuse an "Asteria" calendar from a previous connection or create a fresh one. */
async function ensureTargetCalendar(
  api: calendar_v3.Calendar,
  connection: SyncableConnection,
): Promise<string> {
  if (connection.targetCalendarId) return connection.targetCalendarId;

  const owned = await api.calendarList.list({ showDeleted: false, minAccessRole: "owner" });
  const existing = (owned.data.items ?? []).find(
    (entry) => entry.summary === TARGET_CALENDAR_SUMMARY && typeof entry.id === "string"
  );
  if (existing?.id) {
    await prisma.googleCalendarConnection.update({
      where: { ownerId: connection.ownerId },
      data: { targetCalendarId: existing.id },
    });
    return existing.id;
  }

  const created = await api.calendars.insert({
    requestBody: { summary: TARGET_CALENDAR_SUMMARY },
  });
  if (!created.data.id) throw new Error("Google did not return the Asteria calendar id.");
  await prisma.googleCalendarConnection.update({
    where: { ownerId: connection.ownerId },
    data: { targetCalendarId: created.data.id },
  });
  return created.data.id;
}

function googleEventBody(event: PushableEvent): calendar_v3.Schema$Event {
  const timezone = readCalendarTimezone(event.timezone);
  const base: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    extendedProperties: { private: { asteriaEventId: event.id } },
  };
  if (event.isAllDay) {
    // Asteria stores exclusive all-day ends; Google end dates are exclusive too.
    return {
      ...base,
      start: { date: formatCalendarLocal(event.startsAt, timezone).slice(0, 10) },
      end: { date: formatCalendarLocal(event.endsAt, timezone).slice(0, 10) },
    };
  }
  return {
    ...base,
    start: { dateTime: event.startsAt.toISOString(), timeZone: timezone },
    end: { dateTime: event.endsAt.toISOString(), timeZone: timezone },
  };
}

async function recordPushResult(eventId: string, result: GooglePushResult) {
  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: result.ok
      ? { googleEventId: result.googleEventId, syncState: "synced", syncError: null }
      : { syncState: "failed", syncError: result.error },
  });
}

/** Create or update the event in the Asteria Google calendar. */
async function pushEventToGoogle(
  connection: SyncableConnection,
  event: PushableEvent,
): Promise<GooglePushResult> {
  try {
    const api = await getCalendarClient(connection.refreshTokenEncrypted);
    const calendarId = await ensureTargetCalendar(api, connection);

    if (event.googleEventId) {
      try {
        const updated = await api.events.update({
          calendarId,
          eventId: event.googleEventId,
          requestBody: googleEventBody(event),
        });
        if (updated.data.id) return { ok: true, googleEventId: updated.data.id };
      } catch (error) {
        const status = googleStatus(error);
        if (status !== 404 && status !== 410) return { ok: false, error: pushErrorMessage(error) };
        // The Google event is gone; recreate it below.
      }
    }

    const inserted = await api.events.insert({
      calendarId,
      requestBody: googleEventBody(event),
    });
    if (!inserted.data.id) return { ok: false, error: "Google did not return an event id." };
    return { ok: true, googleEventId: inserted.data.id };
  } catch (error) {
    return { ok: false, error: pushErrorMessage(error) };
  }
}

/** Remove the mirrored copy in Google after the local row is gone. */
async function deleteEventFromGoogle(
  connection: SyncableConnection,
  googleEventId: string,
): Promise<GoogleDeleteResult> {
  try {
    if (!connection.targetCalendarId) return { ok: true };
    const api = await getCalendarClient(connection.refreshTokenEncrypted);
    await api.events.delete({ calendarId: connection.targetCalendarId, eventId: googleEventId });
    return { ok: true };
  } catch (error) {
    const status = googleStatus(error);
    if (status === 404 || status === 410) return { ok: true };
    return { ok: false, error: pushErrorMessage(error) };
  }
}

/**
 * Best-effort two-way sync after a local create or update. Called inside
 * server actions; it must never throw and never block the local result.
 * Occurrence exceptions and recurring series stay local for now.
 */
export async function syncEventToGoogle(ownerId: string, eventId: string): Promise<void> {
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
    if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) return;
    const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, ownerId } });
    if (!event || event.parentId || event.recurrenceRule) return;
    await recordPushResult(event.id, await pushEventToGoogle(connection, event));
  } catch {
    // A Google outage must never fail the local action.
  }
}

/** Fire-and-forget Google removal after a local delete already succeeded. */
export async function deleteEventFromGoogleAfterRemoval(
  ownerId: string,
  googleEventId: string | null,
): Promise<void> {
  if (!googleEventId) return;
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
    if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) return;
    await deleteEventFromGoogle(connection, googleEventId);
  } catch {
    // An orphaned Google event is documented as an accepted limitation.
  }
}

/**
 * Push every non-recurring event that is not yet marked "synced". Covers
 * failed pushes and events created before two-way sync was available.
 */
export async function retryPendingPushes(ownerId: string): Promise<RetryPushSummary> {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
  if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) {
    return { attempted: 0, pushed: 0, failed: 0, skipped: true };
  }

  const pending = await prisma.calendarEvent.findMany({
    where: { ownerId, parentId: null, recurrenceRule: null, syncState: { not: "synced" } },
    orderBy: { startsAt: "asc" },
    take: MAX_RETRY_BATCH,
  });

  let pushed = 0;
  let failed = 0;
  for (const event of pending) {
    const result = await pushEventToGoogle(connection, event);
    await recordPushResult(event.id, result);
    if (result.ok) pushed += 1;
    else failed += 1;
  }
  return { attempted: pending.length, pushed, failed, skipped: false };
}
