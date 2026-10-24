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
  prismaSchemaSignature?: string;
};

// Next.js development can keep globalThis alive after Prisma Client
// is regenerated. Include one field enum per model that gains new
// columns over time so an instance created before a regeneration
// is never reused with queries it cannot understand.
const schemaSignature = JSON.stringify({
  task: Prisma.TaskScalarFieldEnum,
  calendarEvent: Prisma.CalendarEventScalarFieldEnum,
  googleCalendarConnection: Prisma.GoogleCalendarConnectionScalarFieldEnum,
  googleCalendarSource: Prisma.GoogleCalendarSourceScalarFieldEnum,
  googleEventMirror: Prisma.GoogleEventMirrorScalarFieldEnum,
});

const cachedClient =
  globalForPrisma.prismaSchemaSignature === schemaSignature
    ? globalForPrisma.prisma
    : undefined;

export const prisma =
  cachedClient ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = schemaSignature;
}
