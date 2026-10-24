import type { calendar_v3 } from "googleapis";

import { prisma } from "@/lib/prisma";
import { hasGoogleWriteScopes } from "./config";
import { getCalendarClient } from "./calendar-api";
import { readCalendarTimezone, formatCalendarLocal } from "../date-time";
import { toRecurrenceRule } from "../recurrence";

// All pushed events live in one dedicated secondary calendar so the
// user's personal Google calendars are never modified by Asteria.
const TARGET_CALENDAR_SUMMARY = "Asteria";
const MAX_RETRY_BATCH = 100;
// Occurrence listings are bounded so a pathological series cannot pin the sync.
const MAX_INSTANCES = 1000;

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
  recurrenceRule: string | null;
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

async function resolveTarget(connection: SyncableConnection) {
  const api = await getCalendarClient(connection.refreshTokenEncrypted);
  const calendarId = await ensureTargetCalendar(api, connection);
  return { api, calendarId };
}

function googleStartEnd(
  startsAt: Date,
  endsAt: Date,
  isAllDay: boolean,
  timezone: ReturnType<typeof readCalendarTimezone>
): calendar_v3.Schema$Event {
  if (isAllDay) {
    // Asteria stores exclusive all-day ends; Google end dates are exclusive too.
    return {
      start: { date: formatCalendarLocal(startsAt, timezone).slice(0, 10) },
      end: { date: formatCalendarLocal(endsAt, timezone).slice(0, 10) },
    };
  }
  return {
    start: { dateTime: startsAt.toISOString(), timeZone: timezone },
    end: { dateTime: endsAt.toISOString(), timeZone: timezone },
  };
}

function googleEventBody(event: PushableEvent): calendar_v3.Schema$Event {
  const timezone = readCalendarTimezone(event.timezone);
  const recurrence = toRecurrenceRule(event.recurrenceRule, {
    startsAt: event.startsAt,
    timezone,
    isAllDay: event.isAllDay,
  });
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    extendedProperties: { private: { asteriaEventId: event.id } },
    ...googleStartEnd(event.startsAt, event.endsAt, event.isAllDay, timezone),
    ...(recurrence ? { recurrence: [recurrence] } : {}),
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
async function pushEventWith(
  api: calendar_v3.Calendar,
  calendarId: string,
  event: PushableEvent,
): Promise<GooglePushResult> {
  try {
    if (event.recurrenceRule) {
      // Recurring series are replaced wholesale: Google keeps per-instance
      // overrides when a master is updated, so delete + insert is the only
      // way to guarantee Google matches the local series exactly.
      if (event.googleEventId) {
        try {
          await api.events.delete({ calendarId, eventId: event.googleEventId });
        } catch (error) {
          const status = googleStatus(error);
          if (status !== 404 && status !== 410) {
            return { ok: false, error: pushErrorMessage(error) };
          }
        }
      }
      const inserted = await api.events.insert({
        calendarId,
        requestBody: googleEventBody(event),
      });
      if (!inserted.data.id) return { ok: false, error: "Google did not return an event id." };
      return { ok: true, googleEventId: inserted.data.id };
    }

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

function instanceStartMatches(
  instance: calendar_v3.Schema$Event,
  originalStart: Date,
  timezone: ReturnType<typeof readCalendarTimezone>
): boolean {
  const original = instance.originalStartTime;
  if (!original) return false;
  if (original.date) return original.date === formatCalendarLocal(originalStart, timezone).slice(0, 10);
  if (original.dateTime) return Date.parse(original.dateTime) === originalStart.getTime();
  return false;
}

/**
 * Apply Asteria's occurrence exceptions to the Google series: edited
 * occurrences become Google instance overrides, cancelled ones are
 * cancelled in place. Best effort per instance; never throws.
 */
async function reconcileSeriesExceptions(
  connection: SyncableConnection,
  series: PushableEvent & { googleEventId: string },
  api: calendar_v3.Calendar,
  calendarId: string,
): Promise<void> {
  try {
    const exceptions = await prisma.calendarEvent.findMany({
      where: { ownerId: connection.ownerId, parentId: series.id },
      orderBy: { originalStart: "asc" },
    });
    if (!exceptions.length) return;

    const instances: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    do {
      const response = await api.events.instances({
        calendarId,
        eventId: series.googleEventId,
        showDeleted: true,
        maxResults: 250,
        pageToken,
      });
      instances.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && instances.length < MAX_INSTANCES);

    const timezone = readCalendarTimezone(series.timezone);
    for (const exception of exceptions) {
      if (!exception.originalStart) continue;
      const instance = instances.find((item) =>
        instanceStartMatches(item, exception.originalStart!, timezone)
      );
      if (!instance?.id) continue;
      try {
        if (exception.isCancelled) {
          if (instance.status !== "cancelled") {
            await api.events.patch({
              calendarId,
              eventId: instance.id,
              requestBody: { status: "cancelled" },
            });
          }
          continue;
        }
        const exceptionTimezone = readCalendarTimezone(exception.timezone);
        await api.events.patch({
          calendarId,
          eventId: instance.id,
          requestBody: {
            summary: exception.title,
            description: exception.description ?? undefined,
            location: exception.location ?? undefined,
            status: "confirmed",
            ...googleStartEnd(exception.startsAt, exception.endsAt, exception.isAllDay, exceptionTimezone),
          },
        });
      } catch {
        // One unmatched instance must not block the rest of the series.
      }
    }
  } catch {
    // Reconciliation is best effort; the series itself already synced.
  }
}

/** Best-effort two-way sync after a local create or update. Called inside
 * server actions; it must never throw and never block the local result.
 * Occurrence exceptions are never pushed directly — the parent series
 * reconciles them against Google's instances. */
export async function syncEventToGoogle(ownerId: string, eventId: string): Promise<void> {
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
    if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) return;
    const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, ownerId } });
    if (!event || event.parentId) return;
    const { api, calendarId } = await resolveTarget(connection);
    const result = await pushEventWith(api, calendarId, event);
    await recordPushResult(event.id, result);
    if (result.ok && event.recurrenceRule) {
      await reconcileSeriesExceptions(
        connection,
        { ...event, googleEventId: result.googleEventId },
        api,
        calendarId
      );
    }
  } catch {
    // A Google outage must never fail the local action.
  }
}

/** Re-apply a series' exceptions after a single occurrence edit/cancel. */
export async function reconcileGoogleExceptionsForOwner(
  ownerId: string,
  seriesId: string,
): Promise<void> {
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
    if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) return;
    const series = await prisma.calendarEvent.findFirst({ where: { id: seriesId, ownerId } });
    if (!series || !series.recurrenceRule || !series.googleEventId) return;
    const { api, calendarId } = await resolveTarget(connection);
    await reconcileSeriesExceptions(connection, { ...series, googleEventId: series.googleEventId }, api, calendarId);
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
 * Push every event that is not yet marked "synced". Covers failed pushes,
 * recurring series, and events created before two-way sync was available.
 */
export async function retryPendingPushes(ownerId: string): Promise<RetryPushSummary> {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId } });
  if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) {
    return { attempted: 0, pushed: 0, failed: 0, skipped: true };
  }

  const pending = await prisma.calendarEvent.findMany({
    where: { ownerId, parentId: null, syncState: { not: "synced" } },
    orderBy: { startsAt: "asc" },
    take: MAX_RETRY_BATCH,
  });
  if (!pending.length) {
    return { attempted: 0, pushed: 0, failed: 0, skipped: false };
  }

  const { api, calendarId } = await resolveTarget(connection);

  let pushed = 0;
  let failed = 0;
  for (const event of pending) {
    const result = await pushEventWith(api, calendarId, event);
    await recordPushResult(event.id, result);
    if (result.ok) {
      pushed += 1;
      if (event.recurrenceRule) {
        await reconcileSeriesExceptions(
          connection,
          { ...event, googleEventId: result.googleEventId },
          api,
          calendarId
        );
      }
    } else {
      failed += 1;
    }  }
  return { attempted: pending.length, pushed, failed, skipped: false };
}
