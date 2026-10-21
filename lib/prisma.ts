
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured."
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaCalendarSchema?: string;
};

// A generated client can change while Next dev keeps globalThis alive.
// Do not reuse an instance whose Calendar model predates regeneration.
const calendarSchema = JSON.stringify(Prisma.CalendarEventScalarFieldEnum);
const cachedClient = globalForPrisma.prismaCalendarSchema === calendarSchema
  ? globalForPrisma.prisma
  : undefined;

export const prisma =
  cachedClient ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaCalendarSchema = calendarSchema;
}
