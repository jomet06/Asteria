import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

/** Never return encrypted tokens or OAuth credentials to React clients. */
export async function getMyGoogleCalendarConnection() {
  const { user } = await getMyAccount();
  return prisma.googleCalendarConnection.findUnique({
    where: { ownerId: user.id },
    select: { googleEmail: true, googleAccountId: true, updatedAt: true },
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
