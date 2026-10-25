import { prisma } from "@/lib/prisma";
import { loadCalendarEvents } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  parseCalendarLocal,
  readCalendarTimezone,
} from "@/features/calendar/date-time";
import { sendDiscordMessage } from "./rest";

const DAY_MS = 86_400_000;
const EVENT_LEAD_MS = 15 * 60_000;
const DEADLINE_LEAD_MS = DAY_MS;
const MAX_SENDS_PER_TICK = 20;
const MAX_CONNECTIONS = 100;

export type TickResult = { sent: number; skipped: number };

type DueNotification = {
  ownerId: string;
  channelId: string;
  kind: "event_starting" | "deadline_soon" | "task_overdue" | "daily_plan";
  refKey: string;
  text: string;
};

/**
 * Evaluate reminder triggers (PRD 4.7) for every linked Discord user and
 * push due ones. The notification log is written BEFORE sending so a
 * reminder can never repeat, even across concurrent ticks.
 */
export async function runDiscordReminderTick(): Promise<TickResult> {
  const connections = await prisma.discordConnection.findMany({
    orderBy: { updatedAt: "asc" },
    take: MAX_CONNECTIONS,
  });
  if (!connections.length) return { sent: 0, skipped: 0 };

  const now = new Date();
  const due: DueNotification[] = [];

  for (const connection of connections) {
    if (!connection.dmChannelId) continue;
    const profile = await prisma.profile.findUnique({
      where: { id: connection.ownerId },
      select: { timezone: true },
    });
    const timezone = readCalendarTimezone(profile?.timezone);
    const today = formatCalendarLocal(now, timezone).slice(0, 10);

    // 1. Events starting within the next 15 minutes.
    const { events } = await loadCalendarEvents(connection.ownerId, now, new Date(now.getTime() + DAY_MS));
    for (const event of events) {
      if (event.isAllDay) continue;
      const start = Date.parse(event.startsAt);
      if (start >= now.getTime() && start <= now.getTime() + EVENT_LEAD_MS) {
        due.push({
          ownerId: connection.ownerId,
          channelId: connection.dmChannelId,
          kind: "event_starting",
          refKey: `event:${event.id}:${start}`,
          text: `⏰ “${event.title.slice(0, 100)}” starts at ${formatCalendarLocal(event.startsAt, timezone).slice(11, 16)}.`,
        });
      }
    }

    // 2. Deadlines due within the next 24 hours.
    const upcoming = await prisma.task.findMany({
      where: { ownerId: connection.ownerId, status: { in: ["TODO", "IN_PROGRESS"] }, dueAt: { gte: now, lt: new Date(now.getTime() + DEADLINE_LEAD_MS) } },
      select: { id: true, title: true, dueAt: true },
      take: 20,
    });
    for (const task of upcoming) {
      const dueAt = task.dueAt?.toISOString() ?? "";
      due.push({
        ownerId: connection.ownerId,
        channelId: connection.dmChannelId,
        kind: "deadline_soon",
        refKey: `deadline:${task.id}:${dueAt}`,
        text: `📌 Deadline: “${task.title.slice(0, 100)}” is due ${formatCalendarLocal(task.dueAt!, timezone).replace("T", " ")}.`,
      });
    }

    // 3. Overdue tasks, at most once per day per task.
    const todayStart = parseCalendarLocal(`${today}T00:00`, timezone);
    if (todayStart) {
      const overdue = await prisma.task.findMany({
        where: { ownerId: connection.ownerId, status: { in: ["TODO", "IN_PROGRESS"] }, dueAt: { lt: todayStart } },
        select: { id: true, title: true, dueAt: true },
        take: 20,
      });
      for (const task of overdue) {
        due.push({
          ownerId: connection.ownerId,
          channelId: connection.dmChannelId,
          kind: "task_overdue",
          refKey: `overdue:${task.id}:${today}`,
          text: `⚠️ Overdue: “${task.title.slice(0, 100)}” was due ${formatCalendarLocal(task.dueAt!, timezone).slice(0, 10)}.`,
        });
      }
    }

    // 4. Daily plan recap, once per day during the morning window.
    const hour = Number(formatCalendarLocal(now, timezone).slice(11, 13));
    if (hour >= 7 && hour < 12) {
      const items = await prisma.dailyPlanItem.findMany({
        where: { ownerId: connection.ownerId, plannedDate: new Date(`${today}T00:00:00.000Z`) },
        include: { task: { select: { title: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 10,
      });
      if (items.length) {
        due.push({
          ownerId: connection.ownerId,
          channelId: connection.dmChannelId,
          kind: "daily_plan",
          refKey: `plan:${today}`,
          text: `🗓️ Plan for today (${items.length} task${items.length === 1 ? "" : "s"}): ${items
            .map((item) => item.task.title.slice(0, 40))
            .join(" → ")}`,
        });
      }
    }
  }

  let sent = 0;
  let skipped = 0;
  for (const notification of due.slice(0, MAX_SENDS_PER_TICK)) {
    const inserted = await prisma.notificationLog.createMany({
      data: [{ ownerId: notification.ownerId, kind: notification.kind, refKey: notification.refKey.slice(0, 120) }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      skipped += 1;
      continue;
    }
    const result = await sendDiscordMessage(notification.channelId, notification.text);
    if (!result.ok) {
      // Free the log so the next tick can retry the delivery.
      await prisma.notificationLog.deleteMany({
        where: { ownerId: notification.ownerId, kind: notification.kind, refKey: notification.refKey.slice(0, 120) },
      });
      skipped += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped };
}
