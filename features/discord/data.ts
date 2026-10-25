import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

/** Never expose internal channel or token data to React clients. */
export async function getMyDiscordConnection() {
  const { user } = await getMyAccount();
  return prisma.discordConnection.findUnique({
    where: { ownerId: user.id },
    select: { discordUsername: true, updatedAt: true },
  });
}
