"use server";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { uuidPattern } from "@/features/tasks/workspace-view";
import { categoryEnabled, notificationSchemaPending, parsePreferences } from "./preferences";
import { lockPreferences } from "./service";
import type { NotificationActionResult } from "./types";

function failure(error: unknown): NotificationActionResult {
  return { ok: false, error: notificationSchemaPending(error) ? "Notifications are awaiting database setup." : "Could not save this change. Please retry." };
}

export async function markNotificationRead(id: string): Promise<NotificationActionResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !uuidPattern.test(id)) return { ok: false, error: "Invalid notification." };
  try {
    await prisma.notificationLog.updateMany({ where: { id, ownerId: user.id, inApp: true, dismissedAt: null, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const user = await requireUser();
  try {
    await prisma.notificationLog.updateMany({ where: { ownerId: user.id, inApp: true, dismissedAt: null, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function dismissNotification(id: string): Promise<NotificationActionResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !uuidPattern.test(id)) return { ok: false, error: "Invalid notification." };
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.notificationLog.updateMany({ where: { id, ownerId: user.id, inApp: true, dismissedAt: null }, data: { dismissedAt: new Date(), readAt: new Date() } });
      if (changed.count) await tx.notificationDelivery.updateMany({ where: { notificationId: id, ownerId: user.id, status: { in: ["pending", "retry", "sending"] } }, data: { status: "cancelled", claimToken: null, leaseUntil: null, lastError: "dismissed" } });
    });
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function saveNotificationPreferences(value: unknown): Promise<NotificationActionResult> {
  const user = await requireUser();
  const preferences = parsePreferences(value);
  if (!preferences) return { ok: false, error: "Invalid notification preferences." };
  try {
    await prisma.$transaction(async (tx) => {
      await lockPreferences(tx, user.id);
      await tx.notificationPreference.update({ where: { ownerId: user.id }, data: preferences });
      const disabled = ["event_starting", "deadline_soon", "task_overdue", "daily_plan", "plan_ready"].filter((kind) => !categoryEnabled(preferences, kind));
      await tx.notificationDelivery.updateMany({ where: { ownerId: user.id, status: { in: ["pending", "retry", "sending"] }, ...(!preferences.discordEnabled ? {} : { notification: { kind: { in: disabled } } }) }, data: { status: "cancelled", claimToken: null, leaseUntil: null, lastError: "preferences_changed" } });
    });
    return { ok: true };
  } catch (error) { return failure(error); }
}
