import { createHash } from "node:crypto";
import { CALENDAR_TIMEZONES, formatCalendarLocal, type CalendarTimezone } from "@/features/calendar/date-time";
import type { CalendarEventView } from "@/features/calendar/data";
import type { NotificationCandidate, NotificationPreferences } from "./types";

export const DAY_MS = 86_400_000;
export const MAX_ATTEMPTS = 5;
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const stableRef = (value: string) => value.length <= 120 ? value : `sha256:${hash(value)}`;
export const dayAfter = (day: string, days = 1) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
export const localDay = (date: Date, timezone: CalendarTimezone) => formatCalendarLocal(date, timezone).slice(0, 10);
// All currently supported profile zones have fixed offsets. Task/planner dates
// can be outside the calendar editor's 1900–2100 range, so do not use its parser.
export const atHour = (day: string, hour: number, timezone: CalendarTimezone) => new Date(Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00.000Z`) - CALENDAR_TIMEZONES.find((zone) => zone.value === timezone)!.offsetMinutes * 60_000);
export const isDateOnly = (date: Date) => date.toISOString().slice(11) === "00:00:00.000Z";

export function eventCandidate(event: CalendarEventView, preferences: NotificationPreferences, now: Date, timezone: CalendarTimezone): NotificationCandidate | null {
  // All-day dates float across timezones in the calendar UI. Remind before
  // midnight on that displayed date in the owner's timezone, without shifting
  // Google's canonical date-only storage into the previous/next date.
  const day = event.kind === "google" ? event.startsAt.slice(0, 10) : formatCalendarLocal(event.startsAt, event.timezone).slice(0, 10);
  const start = event.isAllDay ? atHour(day, 0, timezone) : new Date(event.startsAt);
  const scheduledAt = new Date(start.getTime() - preferences.eventLeadMinutes * 60_000);
  if (now < scheduledAt || now >= start) return null;
  return {
    kind: "event_starting", refKey: stableRef(`event:${event.id}:${start.getTime()}`),
    title: "Upcoming event", message: `“${event.title.slice(0, 150)}” starts ${event.isAllDay ? `on ${day}` : `at ${formatCalendarLocal(start, timezone).replace("T", " ")}`} (${timezone}).`,
    href: `/calendar?date=${localDay(start, timezone)}&view=day`, sourceType: "event", sourceId: event.id,
    sourceVersion: start.toISOString(), scheduledAt, expiresAt: start,
  };
}

export function taskCandidates(task: { id: string; title: string; dueAt: Date | null; status: string }, preferences: NotificationPreferences, now: Date, timezone: CalendarTimezone): NotificationCandidate[] {
  if (!task.dueAt || !["TODO", "IN_PROGRESS"].includes(task.status)) return [];
  const dateOnly = isDateOnly(task.dueAt);
  const day = task.dueAt.toISOString().slice(0, 10);
  const today = localDay(now, timezone);
  // UTC midnight is a calendar date, not an exact 07:00/08:00/09:00 deadline.
  const deadline = dateOnly ? atHour(dayAfter(day), 0, timezone) : task.dueAt;
  const remindAt = dateOnly ? atHour(dayAfter(day, -preferences.deadlineLeadDays), preferences.morningHour, timezone) : new Date(deadline.getTime() - preferences.deadlineLeadDays * DAY_MS);
  const common = { sourceType: "task" as const, sourceId: task.id, sourceVersion: task.dueAt.toISOString(), href: `/tasks?task=${task.id}` };
  if (now >= remindAt && now < deadline) return [{ ...common,
    kind: "deadline_soon", refKey: `deadline:${task.id}:${task.dueAt.toISOString()}`,
    title: "Deadline approaching", message: `“${task.title.slice(0, 150)}” is due ${dateOnly ? `${day} (end of day)` : formatCalendarLocal(deadline, timezone).replace("T", " ")} (${timezone}).`,
    scheduledAt: remindAt, expiresAt: deadline,
  }];
  if (now >= deadline) return [{ ...common,
    kind: "task_overdue",
    // Preserve the existing daily dedupe key. Once-only policy includes the deadline version.
    refKey: preferences.overdueRepeatDays === 0 ? stableRef(`overdue:${task.id}:once:${task.dueAt.toISOString()}`) : `overdue:${task.id}:${today}`,
    title: "Task overdue", message: `“${task.title.slice(0, 150)}” was due ${dateOnly ? day : formatCalendarLocal(deadline, timezone).replace("T", " ")}.`,
    scheduledAt: atHour(today, 0, timezone), expiresAt: atHour(dayAfter(today), 0, timezone),
  }];
  return [];
}

export function planFingerprint(day: string, items: { taskId: string; position: number }[]): string {
  return hash(`${day}:${items.map((item) => `${item.taskId}:${item.position}`).join("|")}`);
}

export function retryAt(now: Date, attempt: number, retryAfterMs = 0): Date {
  return new Date(now.getTime() + Math.max(Math.min(3_600_000, Math.max(0, retryAfterMs)), Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1))));
}
