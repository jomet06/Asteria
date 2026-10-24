import { prisma } from "@/lib/prisma";
import { loadCalendarEvents } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  parseCalendarLocal,
  type CalendarTimezone,
} from "@/features/calendar/date-time";

const DAY_MS = 86_400_000;
const MAX_CONTEXT_EVENTS = 40;
const MAX_CONTEXT_TASKS = 30;

export type HermesContext = {
  today: string;
  timezone: CalendarTimezone;
  events: { title: string; kind: string; time: string; all_day: boolean }[];
  tasks: {
    id: string;
    title: string;
    priority: string;
    difficulty: string;
    estimated_minutes: number | null;
    progress: number;
    due: string | null;
    depends_on: string | null;
  }[];
};

/** Compact, owner-scoped workspace snapshot handed to the model. */
export async function buildHermesContext(
  ownerId: string,
  timezone: CalendarTimezone
): Promise<HermesContext> {
  const now = new Date();
  const today = formatCalendarLocal(now, timezone).slice(0, 10);
  const dayStart = parseCalendarLocal(`${today}T00:00`, timezone) ?? now;
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const [calendar, tasks] = await Promise.all([
    loadCalendarEvents(ownerId, dayStart, dayEnd),
    prisma.task.findMany({
      where: { ownerId, status: { in: ["TODO", "IN_PROGRESS"] } },
      select: {
        id: true,
        title: true,
        priority: true,
        difficulty: true,
        estimatedMinutes: true,
        progress: true,
        dueAt: true,
        dependsOnTaskId: true,
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: MAX_CONTEXT_TASKS + 1,
    }),
  ]);

  return {
    today,
    timezone,
    events: calendar.events.slice(0, MAX_CONTEXT_EVENTS).map((event) => ({
      title: event.title.slice(0, 120),
      kind: event.kind ?? "event",
      time: `${formatCalendarLocal(event.startsAt, timezone).slice(11, 16)}–${formatCalendarLocal(event.endsAt, timezone).slice(11, 16)}`,
      all_day: event.isAllDay,
    })),
    tasks: tasks.slice(0, MAX_CONTEXT_TASKS).map((task) => ({
      id: task.id,
      title: task.title.slice(0, 120),
      priority: task.priority,
      difficulty: task.difficulty,
      estimated_minutes: task.estimatedMinutes,
      progress: task.progress,
      due: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : null,
      depends_on: task.dependsOnTaskId,
    })),
  };
}
