
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { getMyProjects } from "./projects/data";

export async function getMyTaskWorkspace() {
  const { user } = await getMyAccount();

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        ownerId: user.id,
      },

      include: {
        subtasks: {
          select: {
            id: true,
            title: true,
            isCompleted: true,
            position: true,
          },

          orderBy: [
            { position: "asc" },
            { id: "asc" },
          ],
        },

        dependsOn: {
          select: {
            title: true,
          },
        },
      },

      orderBy: [
        { createdAt: "desc" },
      ],
    }),

    getMyProjects(),
  ]);

  return {
    tasks,
    projects,
  };
}
