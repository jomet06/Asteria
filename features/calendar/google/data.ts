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
