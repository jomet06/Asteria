"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { hasGoogleWriteScopes } from "./config";
import { getCalendarClient, listGoogleCalendars } from "./calendar-api";
import { importGoogleSnapshot } from "./import-sync";
import { GoogleImportError, readCalendarSelection } from "./import-validation";
import { retryPendingPushes } from "./push";

async function connected() {
  const { user } = await getMyAccount();
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId: user.id } });
  if (!connection) throw new Error("Google Calendar is not connected.");
  return { user, connection };
}

export async function loadGoogleCalendars(): Promise<never> {
  const { user, connection } = await connected();
  const api = await getCalendarClient(connection.refreshTokenEncrypted);
  // The Asteria calendar receives pushed events; importing it would duplicate them.
  const calendars = (await listGoogleCalendars(api)).filter(
    (calendar) => calendar.id !== connection.targetCalendarId
  );
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
  // Authenticate outside the error handler so login redirects propagate.
  const { user } = await getMyAccount();
  let outcome = "synced";
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { ownerId: user.id } });
    if (!connection) throw new GoogleImportError("connection_changed");
    const ids = readCalendarSelection(formData.getAll("calendarId"), connection.targetCalendarId);
    await importGoogleSnapshot(connection, ids);
  } catch (error) {
    outcome = error instanceof GoogleImportError ? error.code : "sync_failed";
  }
  // Google writes remain an explicit, separate action: importing is read-only.
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/settings?google=${outcome}`);
}

/** Settings form action: push Asteria events that are not yet in Google. */
export async function syncPendingEventsToGoogle(): Promise<never> {
  const { user, connection } = await connected();
  if (!hasGoogleWriteScopes(connection.grantedScopes)) {
    redirect("/settings?google=push_readonly");
  }
  const summary = await retryPendingPushes(user.id);
  revalidatePath("/settings");
  revalidatePath("/calendar");
  redirect(`/settings?google=${summary.failed > 0 ? "push_partial" : "push_done"}`);
}

