import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { loadCalendarEvents } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  parseCalendarLocal,
  readCalendarTimezone,
  type CalendarTimezone,
} from "@/features/calendar/date-time";

const DAY_MS = 86_400_000;
const OPEN_STATUSES = ["TODO", "IN_PROGRESS"] as const;
const DEADLINE_WINDOW_DAYS = 14;
const MAX_TASKS = 8;

export type DashboardEvent = {
  id: string;
  title: string;
  kind: "event" | "block" | "google";
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  href?: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  planned: boolean;
  done: boolean;
  projectName: string | null;
};

export type DashboardOverview = {
  timezone: CalendarTimezone;
  today: string;
  todayLabel: string;
  now: string;
  events: DashboardEvent[];
  ongoing: DashboardEvent | null;
  next: DashboardEvent | null;
  todaysTasks: DashboardTask[];
  planTasks: DashboardTask[];
  upcomingDeadlines: DashboardTask[];
  reminders: DashboardTask[];
  truncated: boolean;
};

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueAt: true,
  project: { select: { name: true } },
} as const;

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  project: { name: string } | null;
};

function toTask(row: TaskRow, planned = false): DashboardTask {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    planned,
    done: row.status === "DONE",
    projectName: row.project?.name ?? null,
  };
}

/** Request-time snapshot of "today" for the dashboard widgets. */
export async function getMyDashboardOverview(): Promise<DashboardOverview> {
  const { user, profile } = await getMyAccount();
  const timezone = readCalendarTimezone(profile.timezone);
  const now = new Date();
  const today = formatCalendarLocal(now, timezone).slice(0, 10);
  // parseCalendarLocal cannot fail for a date produced by formatCalendarLocal.
  const dayStart = parseCalendarLocal(`${today}T00:00`, timezone) ?? new Date(now);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const deadlineEnd = new Date(dayEnd.getTime() + DEADLINE_WINDOW_DAYS * DAY_MS);
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  const [calendar, dueToday, plannedToday, upcoming, overdue] = await Promise.all([
    loadCalendarEvents(user.id, dayStart, dayEnd),
    prisma.task.findMany({
      where: { ownerId: user.id, status: { in: [...OPEN_STATUSES] }, dueAt: { gte: dayStart, lt: dayEnd } },
      select: taskSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: MAX_TASKS + 1,
    }),
    prisma.dailyPlanItem.findMany({
      where: { ownerId: user.id, plannedDate: new Date(`${today}T00:00:00.000Z`) },
      select: { task: { select: taskSelect } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: MAX_TASKS + 1,
    }),
    prisma.task.findMany({
      where: { ownerId: user.id, status: { in: [...OPEN_STATUSES] }, dueAt: { gte: dayEnd, lte: deadlineEnd } },
      select: taskSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: MAX_TASKS,
    }),
    prisma.task.findMany({
      where: { ownerId: user.id, status: { in: [...OPEN_STATUSES] }, dueAt: { lt: dayStart } },
      select: taskSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: MAX_TASKS,
    }),
  ]);

  const events: DashboardEvent[] = calendar.events
    .filter((event) => event.kind === "event" || event.kind === "block" || event.kind === "google")
    .map((event) => ({
      id: event.id,
      title: event.title,
      kind: event.kind as DashboardEvent["kind"],
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      isAllDay: event.isAllDay,
      href: event.href,
    }));

  const ongoing =
    events.find(
      (event) =>
        !event.isAllDay &&
        Date.parse(event.startsAt) <= now.getTime() &&
        now.getTime() < Date.parse(event.endsAt)
    ) ?? null;
  const next =
    events.find((event) => !event.isAllDay && Date.parse(event.startsAt) > now.getTime()) ?? null;

  // Due-today and planned-today merge into one list; the planner wins on order.
  const merged = new Map<string, DashboardTask>();
  for (const row of dueToday as TaskRow[]) merged.set(row.id, toTask(row));
  for (const item of plannedToday as { task: TaskRow }[]) {
    const existing = merged.get(item.task.id);
    merged.set(item.task.id, existing ? { ...existing, planned: true } : toTask(item.task, true));
  }
  const todaysTasks = [...merged.values()].slice(0, MAX_TASKS);

  return {
    timezone,
    today,
    todayLabel,
    now: now.toISOString(),
    events: events.slice(0, MAX_TASKS),
    ongoing,
    next,
    todaysTasks,
    planTasks: (plannedToday as { task: TaskRow }[]).map(({ task }) => toTask(task, true)).slice(0, MAX_TASKS),
    upcomingDeadlines: (upcoming as TaskRow[]).map((row) => toTask(row)),
    reminders: (overdue as TaskRow[]).map((row) => toTask(row)),
    truncated: calendar.truncated || merged.size > MAX_TASKS,
  };
}
