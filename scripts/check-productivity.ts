
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Checking Productivity Core database...");

  const [projectCount, taskCount, subtaskCount] =
    await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.subtask.count(),
    ]);

  console.log("Prisma connected successfully!");
  console.log("Projects:", projectCount);
  console.log("Tasks:", taskCount);
  console.log("Subtasks:", subtaskCount);
}

main()
  .catch((error) => {
    console.error("Productivity database check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
