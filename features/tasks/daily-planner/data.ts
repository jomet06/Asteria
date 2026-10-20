
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

import { parsePlannerDate } from "./date";

/**
 * Load the authenticated user's daily plan.
 *
 * Returns null for an invalid date.
 */
export async function getMyDailyPlan(
  dateInput: string
) {
  const { user } = await getMyAccount();

  const plannedDate =
    parsePlannerDate(dateInput);

  if (!plannedDate) {
    return null;
  }

  const items =
    await prisma.dailyPlanItem.findMany({
      where: {
        ownerId: user.id,
        plannedDate,
      },

      select: {
        id: true,
        taskId: true,
        plannedDate: true,
        position: true,

        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueAt: true,

            project: {
              select: {
                name: true,
              },
            },
          },
        },
      },

      orderBy: [
        { position: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

  return {
    date: dateInput,
    items,
  };
}
