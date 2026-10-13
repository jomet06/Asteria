
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Checking Prisma connection...");

  const profileCount = await prisma.profile.count();

  console.log("Prisma connected successfully!");
  console.log("Total profiles:", profileCount);
}

main()
  .catch((error) => {
    console.error("Prisma test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
