import { revalidatePath } from "next/cache";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { loadCalendarEvents } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  parseCalendarLocal,
  readCalendarTimezone,
} from "@/features/calendar/date-time";
import { parsePlannerDate } from "@/features/tasks/daily-planner/date";
import { hermesConfigured } from "./config";
import { GeminiError, generateContent, type GeminiSchema } from "./gemini";

const DAY_MS = 86_400_000;
const MAX_PLAN_ITEMS = 15;
const MAX_CONTEXT_TASKS = 30;

const PLAN_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    note: { type: "STRING", description: "One short sentence about the plan's approach." },
    plan: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          task_id: { type: "STRING", description: "Task id exactly as provided." },
          reason: { type: "STRING", description: "Short reason for the position." },
        },
        required: ["task_id"],
      },
    },
  },
  required: ["plan"],
};

const PLANNER_SYSTEM = [
  "You are Hermes, the planning assistant inside Asteria.",
  "Build a realistic ordered daily plan from the user's open tasks and the day's calendar events.",
  "Consider deadlines, priority, difficulty, estimated duration, workload, and the free time left around events.",
  "Only reference the task ids provided; do not invent tasks. Put the most urgent, highest-value work first.",
  "Respond only with JSON matching the schema.",
].join(" ");

export type PlanningResult =
  | { ok: true; added: number; note: string | null }
  | { ok: false; error: "invalid_date" | "not_configured" | "no_open_tasks" | "plan_empty" | "hermes_unavailable" };

/**
 * AI Daily Planning: ask Hermes to order the user's open tasks for a date,
 * then replace that day's manual plan with the validated result.
 */
export async function generateMyDailyPlan(dateInput: unknown): Promise<PlanningResult> {
  const { user, profile } = await getMyAccount();
  if (!hermesConfigured()) return { ok: false, error: "not_configured" };

  const plannedDate = parsePlannerDate(dateInput);
  if (!plannedDate) return { ok: false, error: "invalid_date" };

  const timezone = readCalendarTimezone(profile.timezone);
  const day = plannedDate.toISOString().slice(0, 10);
  const dayStart = parseCalendarLocal(`${day}T00:00`, timezone);
  if (!dayStart) return { ok: false, error: "invalid_date" };

  const openTasks = await prisma.task.findMany({
    where: { ownerId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
    select: { id: true, title: true, priority: true, difficulty: true, estimatedMinutes: true, dueAt: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: MAX_CONTEXT_TASKS,
  });
  if (!openTasks.length) return { ok: false, error: "no_open_tasks" };

  const { events } = await loadCalendarEvents(user.id, dayStart, new Date(dayStart.getTime() + DAY_MS));
  const payload = {
    date: day,
    timezone,
    events: events.slice(0, 40).map((event) => ({
      title: event.title.slice(0, 100),
      kind: event.kind,
      start: formatCalendarLocal(event.startsAt, timezone).slice(11, 16),
      end: formatCalendarLocal(event.endsAt, timezone).slice(11, 16),
      all_day: event.isAllDay,
    })),
    tasks: openTasks.map((task) => ({
      id: task.id,
      title: task.title.slice(0, 120),
      priority: task.priority,
      difficulty: task.difficulty,
      estimated_minutes: task.estimatedMinutes,
      due: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : null,
    })),
  };

  let parsed: { plan?: unknown; note?: unknown };
  try {
    const { parts } = await generateContent({
      system: PLANNER_SYSTEM,
      contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
      jsonSchema: PLAN_SCHEMA,
      temperature: 0.3,
    });
    parsed = JSON.parse(parts.find((part) => typeof part.text === "string")?.text ?? "{}") as typeof parsed;
  } catch (error) {
    if (error instanceof GeminiError && error.status === 429) {
      return { ok: false, error: "hermes_unavailable" };
    }
    return { ok: false, error: "hermes_unavailable" };
  }

  // Only ids from the owner's own open set survive validation.
  const known = new Set(openTasks.map((task) => task.id));
  const seen = new Set<string>();
  const plan = (Array.isArray(parsed.plan) ? parsed.plan : [])
    .filter(
      (item): item is { task_id: string; reason?: unknown } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { task_id?: unknown }).task_id === "string" &&
        known.has((item as { task_id: string }).task_id)
    )
    .filter((item) => {
      if (seen.has(item.task_id)) return false;
      seen.add(item.task_id);
      return true;
    })
    .slice(0, MAX_PLAN_ITEMS);

  if (!plan.length) return { ok: false, error: "plan_empty" };
  const note = typeof parsed.note === "string" && parsed.note.trim()
    ? parsed.note.trim().slice(0, 300)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.dailyPlanItem.deleteMany({ where: { ownerId: user.id, plannedDate } });
    await tx.dailyPlanItem.createMany({
      data: plan.map((item, index) => ({
        ownerId: user.id,
        taskId: item.task_id,
        plannedDate,
        position: index,
      })),
    });
  });

  revalidatePath("/tasks/planner");
  revalidatePath("/dashboard");
  return { ok: true, added: plan.length, note };
}
