"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { getCalendarClient, listGoogleCalendars, listGoogleEvents } from "./calendar-api";

const DAY = 86_400_000;
const MAX_CALENDARS = 3;
const MAX_EVENTS = 2500;

async function connected() {
  const { user } = await getMyAccount();
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId: user.id } });
  if (!connection) throw new Error("Google Calendar is not connected.");
  return { user, connection };
}

export async function loadGoogleCalendars(): Promise<never> {
  const { user, connection } = await connected();
  const api = await getCalendarClient(connection.refreshTokenEncrypted);
  const calendars = await listGoogleCalendars(api);
  await prisma.$transaction(async (tx) => {
    for (const calendar of calendars) {
      await tx.googleCalendarSource.upsert({
        where: { connectionOwnerId_googleCalendarId: { connectionOwnerId: user.id, googleCalendarId: calendar.id! } },
        create: {
          ownerId: user.id,
          connectionOwnerId: user.id,
          googleCalendarId: calendar.id!,
          name: calendar.summary!,
          isPrimary: Boolean(calendar.primary),
        },
        update: { name: calendar.summary!, isPrimary: Boolean(calendar.primary) },
      });
    }
  });
  revalidatePath("/settings");
  redirect("/settings?google=calendars_loaded");
}

export async function syncGoogleCalendars(formData: FormData): Promise<never> {
  const { user, connection } = await connected();
  const selected = formData.getAll("calendarId").filter((value): value is string => typeof value === "string");
  const ids = [...new Set(selected)].slice(0, MAX_CALENDARS);
  if (!ids.length) redirect("/settings?google=no_calendars_selected");

  const sources = await prisma.googleCalendarSource.findMany({
    where: { ownerId: user.id, googleCalendarId: { in: ids } },
  });
  if (sources.length !== ids.length) redirect("/settings?google=invalid_calendars");

  const api = await getCalendarClient(connection.refreshTokenEncrypted);
  const from = new Date(Date.now() - 90 * DAY);
  const to = new Date(Date.now() + 365 * DAY);
  const snapshots = await Promise.all(sources.map(async (source) => ({
    source,
    result: await listGoogleEvents(api, source.googleCalendarId, from, to, MAX_EVENTS),
  })));

  if (snapshots.some(({ result }) => result.truncated)) {
    redirect("/settings?google=sync_truncated");
  }

  await prisma.$transaction(async (tx) => {
    for (const { source, result } of snapshots) {
      await tx.googleEventMirror.deleteMany({ where: { sourceId: source.id, ownerId: user.id } });
      if (result.events.length) {
        await tx.googleEventMirror.createMany({
          data: result.events.map((event) => ({
            ownerId: user.id,
            sourceId: source.id,
            googleEventId: event.googleEventId,
            title: event.title,
            description: event.description,
            location: event.location,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timezone: event.timezone,
            isAllDay: event.isAllDay,
            htmlLink: event.htmlLink,
            googleUpdatedAt: event.googleUpdatedAt,
          })),
        });
      }
      await tx.googleCalendarSource.update({
        where: { id: source.id },
        data: { selected: true, syncStatus: "success", lastSuccessfulSync: new Date(), lastSyncError: null },
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/calendar");
  redirect("/settings?google=synced");
}

