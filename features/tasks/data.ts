
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

export async function getMyTaskWorkspace() {
  const { user } = await getMyAccount();

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        ownerId: user.id,
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    }),

    prisma.project.findMany({
      where: {
        ownerId: user.id,
      },
      select: {
        id: true,
        name: true,
        isArchived: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    tasks,
    projects,
  };
}
