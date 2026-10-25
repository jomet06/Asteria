import { randomBytes } from "node:crypto";
import type { GoogleCalendarConnection, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCalendarClient, listGoogleEvents } from "./calendar-api";
import { GoogleImportError } from "./import-validation";

const LEASE_MS = 5 * 60_000;

// This row lock only spans short database transactions, never Google requests.
// It also serializes the final account check with OAuth reconnect/disconnect.
async function verifyConnection(tx: Prisma.TransactionClient, expected: GoogleCalendarConnection) {
  await tx.$queryRaw`SELECT owner_id FROM public.google_calendar_connections
    WHERE owner_id = ${expected.ownerId}::uuid FOR UPDATE`;
  const current = await tx.googleCalendarConnection.findUnique({ where: { ownerId: expected.ownerId } });
  if (!current || current.googleAccountId !== expected.googleAccountId ||
      current.refreshTokenEncrypted !== expected.refreshTokenEncrypted ||
      current.updatedAt.getTime() !== expected.updatedAt.getTime()) {
    throw new GoogleImportError("connection_changed");
  }
}

/** Caller supplies only an authenticated connection, never a browser owner ID. */
export async function importGoogleSnapshot(connection: GoogleCalendarConnection, ids: string[]) {
  const ownerId = connection.ownerId;
  // Fencing token fits existing VARCHAR(32); no schema migration is needed.
  const token = `syncing:${randomBytes(10).toString("hex")}`;
  const sources = await prisma.$transaction(async (tx) => {
    await verifyConnection(tx, connection);
    const all = await tx.googleCalendarSource.findMany({ where: { ownerId, connectionOwnerId: ownerId } });
    const selected = all.filter((source) => ids.includes(source.googleCalendarId));
    if (selected.length !== ids.length) throw new GoogleImportError("invalid_calendars");
    // Lock all sources for this owner so disjoint selections cannot race either.
    const claimed = await tx.googleCalendarSource.updateMany({
      where: {
        ownerId, connectionOwnerId: ownerId,
        id: { in: all.map((source) => source.id) },
        OR: [{ syncStatus: { not: { startsWith: "syncing:" } } }, { updatedAt: { lt: new Date(Date.now() - LEASE_MS) } }],
      },
      data: { syncStatus: token },
    });
    if (claimed.count !== all.length) throw new GoogleImportError("sync_busy");
    return { all, selected };
  });

  try {
    const now = Date.now();
    const from = new Date(now - 90 * 86_400_000);
    const to = new Date(now + 365 * 86_400_000);
    const api = await getCalendarClient(connection.refreshTokenEncrypted);
    // Every request finishes before any snapshot is replaced. Failures cannot
    // leave other fetches running after the lease is released.
    const settled = await Promise.allSettled(sources.selected.map(async (source) => ({
      source,
      result: await listGoogleEvents(api, source.googleCalendarId, from, to, 2500),
    })));
    const snapshots = settled.map((item) => {
      if (item.status === "rejected") throw item.reason;
      if (item.value.result.truncated) throw new GoogleImportError("sync_truncated");
      return item.value;
    });

    await prisma.$transaction(async (tx) => {
      await verifyConnection(tx, connection);
      const released = await tx.googleCalendarSource.updateMany({
        where: { ownerId, connectionOwnerId: ownerId, id: { in: sources.all.map((source) => source.id) }, syncStatus: token },
        data: { syncStatus: "idle", selected: false },
      });
      // A stale worker cannot overwrite a newer worker's snapshot or status.
      if (released.count !== sources.all.length) throw new GoogleImportError("sync_busy");
      for (const { source, result } of snapshots) {
        await tx.googleEventMirror.deleteMany({ where: { sourceId: source.id, ownerId } });
        if (result.events.length) {
          await tx.googleEventMirror.createMany({
            data: result.events.map((event) => ({ ...event, ownerId, sourceId: source.id })),
          });
        }
        await tx.googleCalendarSource.updateMany({
          where: { id: source.id, ownerId, connectionOwnerId: ownerId },
          data: { selected: true, syncStatus: "success", lastSuccessfulSync: new Date(), lastSyncError: null },
        });
      }
    }, { timeout: 15_000 });
  } catch (error) {
    // Release only this operation's claims; never touch a newer sync's claims.
    // Last successful sync, selection and all mirrors remain intact on failure.
    await prisma.$transaction(async (tx) => {
      for (const source of sources.all) {
        await tx.googleCalendarSource.updateMany({
          where: { ownerId, id: source.id, syncStatus: token },
          data: sources.selected.some((item) => item.id === source.id)
            ? { syncStatus: "error", lastSyncError: error instanceof GoogleImportError ? error.code : "sync_failed" }
            : { syncStatus: source.syncStatus, lastSyncError: source.lastSyncError },
        });
      }
    });
    throw error;
  }
}
