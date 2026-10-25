import { prisma } from "@/lib/prisma";
import { DEFAULT_PREFERENCES, notificationSchemaPending, publicPreferences } from "./preferences";
import type { NotificationInbox } from "./types";

export async function getNotificationPreferences(ownerId: string) {
  try {
    const stored = await prisma.notificationPreference.findUnique({ where: { ownerId } });
    return { preferences: publicPreferences(stored ?? DEFAULT_PREFERENCES), schemaPending: false };
  } catch (error) {
    if (!notificationSchemaPending(error)) throw error;
    return { preferences: DEFAULT_PREFERENCES, schemaPending: true };
  }
}

/** Owner is supplied by server authentication, never by query/body parameters. */
export async function getNotificationInbox(ownerId: string, cursor?: string | null): Promise<NotificationInbox> {
  try {
    const active = { ownerId, inApp: true, dismissedAt: null, title: { not: null } };
    // Cursor lookup is owner-scoped; arbitrary foreign IDs grant no access.
    const before = cursor ? await prisma.notificationLog.findFirst({ where: { ...active, id: cursor }, select: { id: true, createdAt: true } }) : null;
    const [rows, unread, preferences] = await prisma.$transaction([
      prisma.notificationLog.findMany({ where: { ...active, ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21 }),
      prisma.notificationLog.count({ where: { ...active, readAt: null } }),
      prisma.notificationPreference.findUnique({ where: { ownerId } }),
    ]);
    const items = rows.slice(0, 20).map((row) => ({ id: row.id, kind: row.kind, title: row.title!, message: row.message ?? "", href: safeNotificationHref(row.href), createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null }));
    return { items, unread, hasMore: rows.length > 20, nextCursor: rows.length > 20 ? items.at(-1)!.id : null, schemaPending: false, enabled: preferences?.inAppEnabled ?? true };
  } catch (error) {
    if (!notificationSchemaPending(error)) throw error;
    return { items: [], unread: 0, hasMore: false, nextCursor: null, schemaPending: true, enabled: true };
  }
}

export function safeNotificationHref(value: string | null): string {
  return value && /^\/(calendar|tasks)(\?|\/planner(?:\?|$)|$)/.test(value) && !/[\r\n\\]/.test(value) ? value : "/dashboard";
}
