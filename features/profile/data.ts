
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

export async function getMyAccount() {
  const user = await requireUser();

  const providerName = user.user_metadata?.full_name;

  const profile = await prisma.profile.upsert({
    where: {
      id: user.id,
    },
    update: {},
    create: {
      id: user.id,
      displayName:
        typeof providerName === "string"
          ? providerName.slice(0, 80)
          : null,
    },
  });

  return {
    user,
    profile,
  };
}
