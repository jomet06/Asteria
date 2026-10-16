
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

export async function getMyProjects() {
  const { user } = await getMyAccount();

  return prisma.project.findMany({
    where: {
      ownerId: user.id,
    },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: [
      { isArchived: "asc" },
      { createdAt: "desc" },
    ],
  });
}
