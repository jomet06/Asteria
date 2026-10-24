import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

import {
  calendarMonthRange,
  formatCalendarLocal,
  parseCalendarLocal,
  readCalendarMonth,
  readCalendarTimezone,
  type CalendarTimezone,
} from "./date-time";

import { expandSeries } from "./recurrence";

export type CalendarEventView = {
  id: string;
  seriesId?: string;
  originalStart?: string;
  taskId?: string | null;
  kind?: "event" | "deadline" | "planner" | "block" | "google";
  href?: string;
  seriesStartsAt?: string;
  seriesEndsAt?: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timezone: CalendarTimezone;
  isAllDay: boolean;
  recurrenceRule: string | null;
};

export async function getMyCalendarMonth(requestedMonth: unknown) {
  const { user, profile } = await getMyAccount();
  const timezone = readCalendarTimezone(profile.timezone);
  const month = readCalendarMonth(requestedMonth, timezone);
  const range = calendarMonthRange(month, timezone);

  const from = new Date(range.from.getTime() - 7 * 86_400_000);
  // A fixed 42-cell month grid can extend 13 days into the following month.
  const to = new Date(range.to.getTime() + 14 * 86_400_000);
  const { events: calendarEvents, truncated: eventTruncated, schemaPending } = await loadCalendarEvents(user.id, from, to);
  const [deadlines, plans, tasks] = await Promise.all([
    prisma.task.findMany({ where: { ownerId: user.id, status: { not: "CANCELLED" }, dueAt: { gte: from, lt: to } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 501 }),
    prisma.dailyPlanItem.findMany({ where: { ownerId: user.id, plannedDate: { gte: new Date(`${formatCalendarLocal(from, timezone).slice(0, 10)}T00:00:00Z`), lt: new Date(`${formatCalendarLocal(to, timezone).slice(0, 10)}T00:00:00Z`) } }, include: { task: true }, orderBy: [{ plannedDate: "asc" }, { position: "asc" }, { id: "asc" }], take: 501 }),
    prisma.task.findMany({ where: { ownerId: user.id }, select: { id: true, title: true }, orderBy: [{ title: "asc" }, { id: "asc" }], take: 501 }),
  ]);
  const projections: CalendarEventView[] = [];
  for (const task of deadlines.slice(0, 500)) {
    const start = task.dueAt!;
    projections.push({ id: `deadline:${task.id}`, title: `Deadline: ${task.title} (${task.status})`, description: task.description, location: null, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 60000).toISOString(), timezone, isAllDay: false, recurrenceRule: null, kind: "deadline", href: "/tasks" });
  }
  for (const plan of plans.slice(0, 500)) {
    const day = plan.plannedDate.toISOString().slice(0, 10);
    const start = parseCalendarLocal(`${day}T00:00`, timezone)!;
    projections.push({ id: `planner:${plan.id}`, title: `Plan: ${plan.task.title} (${plan.task.status})`, description: plan.task.description, location: null, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 86400000).toISOString(), timezone, isAllDay: true, recurrenceRule: null, kind: "planner", href: `/tasks/planner?date=${day}` });
  }
  const events = [...calendarEvents, ...projections];
  const truncated = eventTruncated || deadlines.length > 500 || plans.length > 500;

  return {
    events,
    schemaPending,
    tasks: tasks.slice(0, 500),
    tasksTruncated: tasks.length > 500,
    timezone,
    month,
    monthLabel: range.label,
    previousMonth: range.previousMonth,
    nextMonth: range.nextMonth,
    limit: 500,
    truncated,
  };
}

/** Authenticated callers supply the session owner, never a form ownerId. */
async function readCalendarRows(ownerId: string, from: Date, to: Date) {
  try {
  const rows = await prisma.calendarEvent.findMany({
    where: { ownerId, parentId: null, OR: [
      { startsAt: { lt: to }, endsAt: { gt: from } },
      { recurrenceRule: { not: null }, startsAt: { lt: to } },
      { exceptions: { some: { startsAt: { lt: to }, endsAt: { gt: from } } } },
    ] },
    include: { exceptions: { where: { ownerId }, orderBy: { originalStart: "asc" }, take: 501 } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 501,
  });
  return { rows, schemaPending: false };
  } catch (error) {
    // Only fall back for completion columns that are not yet migrated.
    // Authentication, connection and unrelated database errors must still surface.
    const failure = error as { code?: string; meta?: { column?: string; driverAdapterError?: { cause?: { column?: string } } } };
    const column = failure?.meta?.driverAdapterError?.cause?.column ?? failure?.meta?.column ?? "";
    if (failure?.code !== "P2022" || !/^(?:public\.)?calendar_events\.(task_id|parent_id|original_start|is_cancelled)$/.test(column.replaceAll('"', ""))) throw error;
    const legacy = await prisma.calendarEvent.findMany({
      where: { ownerId, OR: [
        { startsAt: { lt: to }, endsAt: { gt: from } },
        { recurrenceRule: { not: null }, startsAt: { lt: to } },
      ] },
      select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, timezone: true, isAllDay: true, recurrenceRule: true, ownerId: true, createdAt: true, updatedAt: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 501,
    });
    return { rows: legacy.map((row) => ({ ...row, taskId: null, parentId: null, originalStart: null, isCancelled: false, exceptions: [] })), schemaPending: true };
  }
}

export async function loadCalendarEvents(ownerId: string, from: Date, to: Date) {
  const { rows, schemaPending } = await readCalendarRows(ownerId, from, to);
  const events: CalendarEventView[] = [];
  let truncated = rows.length > 500;
  for (const row of rows.slice(0, 500)) {
    // Fail visibly instead of resurrecting omitted deleted occurrences.
    if (row.exceptions.length > 500) throw new Error("This series exceeds the 500 exception limit.");
    const zone = readCalendarTimezone(row.timezone);
    const instances = expandSeries({ ...row, timezone: zone }, from, to);
    if (instances.length > 500) truncated = true;
    const excluded = new Set(row.exceptions.map((item) => item.originalStart!.toISOString()));
    for (const instance of instances) {
      if (excluded.has(instance.originalStart.toISOString())) continue;
      events.push({ id: `${row.id}:${instance.originalStart.toISOString()}`, seriesId: row.id, originalStart: instance.originalStart.toISOString(), title: row.title, description: row.description, location: row.location, startsAt: instance.startsAt.toISOString(), endsAt: instance.endsAt.toISOString(), timezone: zone, isAllDay: row.isAllDay, recurrenceRule: row.recurrenceRule, taskId: row.taskId, kind: row.taskId ? "block" : "event", seriesStartsAt: row.startsAt.toISOString(), seriesEndsAt: row.endsAt.toISOString() });
    }
    for (const item of row.exceptions) {
      if (item.isCancelled || item.startsAt >= to || item.endsAt <= from) continue;
      events.push({ id: item.id, seriesId: row.id, originalStart: item.originalStart!.toISOString(), title: item.title, description: item.description, location: item.location, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), timezone: readCalendarTimezone(item.timezone), isAllDay: item.isAllDay, recurrenceRule: row.recurrenceRule, taskId: row.taskId, kind: row.taskId ? "block" : "event", seriesStartsAt: row.startsAt.toISOString(), seriesEndsAt: row.endsAt.toISOString() });
    }
  }
  // Google mirrors are additive and remain read-only. The migration is optional
  // during rollout, so an absent table must not hide internal calendar events.
  try {
    const mirrors = await prisma.googleEventMirror.findMany({
      where: { ownerId, startsAt: { lt: to }, endsAt: { gt: from } },
      include: { source: { select: { name: true } } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 501,
    });
    for (const mirror of mirrors.slice(0, 500)) {
      events.push({
        id: `google:${mirror.sourceId}:${mirror.googleEventId}`,
        title: mirror.title,
        description: mirror.description,
        location: mirror.location,
        startsAt: mirror.startsAt.toISOString(),
        endsAt: mirror.endsAt.toISOString(),
        timezone: readCalendarTimezone(mirror.timezone),
        isAllDay: mirror.isAllDay,
        recurrenceRule: null,
        kind: "google",
        href: mirror.htmlLink ?? undefined,
      });
    }
    if (mirrors.length > 500) truncated = true;
  } catch (error) {
    const failure = error as { code?: string };
    if (failure.code !== "P2021" && failure.code !== "P2022") throw error;
  }
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return { events: events.slice(0, 500), truncated: truncated || events.length > 500, schemaPending };
}
