import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { hasGoogleWriteScopes } from "./config";

/** Never return encrypted tokens or OAuth credentials to React clients. */
export async function getMyGoogleCalendarConnection() {
  const { user } = await getMyAccount();
  return prisma.googleCalendarConnection.findUnique({
    where: { ownerId: user.id },
    select: { googleEmail: true, googleAccountId: true, grantedScopes: true, targetCalendarId: true, updatedAt: true },
  });
}

/** Non-recurring events that are not yet mirrored to Google (0 when read-only). */
export async function getMyGooglePushBacklog() {
  const { user } = await getMyAccount();
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { ownerId: user.id },
    select: { grantedScopes: true },
  });
  if (!connection || !hasGoogleWriteScopes(connection.grantedScopes)) return 0;
  return prisma.calendarEvent.count({
    where: { ownerId: user.id, parentId: null, recurrenceRule: null, syncState: { not: "synced" } },
  });
}

export async function getMyGoogleCalendarSources() {
  const { user } = await getMyAccount();
  return prisma.googleCalendarSource.findMany({
    where: { ownerId: user.id },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: { id: true, googleCalendarId: true, name: true, isPrimary: true, selected: true, syncStatus: true, lastSuccessfulSync: true },
  });
}
