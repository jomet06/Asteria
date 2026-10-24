import { createCalendarEvent } from "@/features/calendar/actions";
import { createTask, toggleTaskStatus } from "@/features/tasks/actions";
import { loadCalendarEvents } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  parseCalendarLocal,
  type CalendarTimezone,
} from "@/features/calendar/date-time";
import type { GeminiTool } from "./gemini";

const DAY_MS = 86_400_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const FREE_DAY_START = 7 * 60; // 07:00
const FREE_DAY_END = 22 * 60; // 22:00

export type ToolOutcome = { summary: string; result: Record<string, unknown> };

export const hermesTools: GeminiTool[] = [
  {
    name: "create_event",
    description:
      "Create a calendar event in the user's workspace. Times are in the user's timezone. Weekly repeats require weekdays (0=Sunday..6=Saturday).",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Event title, 1-200 characters." },
        date: { type: "STRING", description: "Start date, YYYY-MM-DD." },
        start_time: { type: "STRING", description: "HH:mm (24h). Ignored for all-day." },
        end_time: { type: "STRING", description: "HH:mm (24h). Ignored for all-day." },
        is_all_day: { type: "BOOLEAN", description: "All-day event." },
        end_date: { type: "STRING", description: "All-day inclusive end date, YYYY-MM-DD. Defaults to date." },
        location: { type: "STRING", description: "Optional location." },
        description: { type: "STRING", description: "Optional details." },
        repeat: { type: "STRING", enum: ["none", "daily", "weekly", "monthly"] },
        weekdays: { type: "ARRAY", items: { type: "INTEGER" }, description: "Weekly repeat days, 0=Sunday..6=Saturday." },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a to-do task. Optionally set a due date, priority, difficulty, and an estimated duration in minutes.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Task title, 1-200 characters." },
        due_date: { type: "STRING", description: "Optional due date, YYYY-MM-DD." },
        priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        difficulty: { type: "STRING", enum: ["EASY", "NORMAL", "HARD"] },
        estimated_minutes: { type: "INTEGER", description: "1-1440." },
        description: { type: "STRING", description: "Optional details." },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "Mark one of the user's open tasks as done by its id from the workspace snapshot.",
    parameters: {
      type: "OBJECT",
      properties: { task_id: { type: "STRING", description: "Task id from the workspace snapshot." } },
      required: ["task_id"],
    },
  },
  {
    name: "find_free_slots",
    description: "Find free time windows on a date between 07:00 and 22:00 in the user's timezone.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "Date, YYYY-MM-DD." },
        duration_minutes: { type: "INTEGER", description: "Minimum gap length, 15-600. Default 60." },
      },
      required: ["date"],
    },
  },
];

function readString(args: Record<string, unknown>, key: string, max = 500): string | null {
  const value = args[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function readInt(args: Record<string, unknown>, key: string, min: number, max: number): number | null {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

async function runCreateEvent(
  args: Record<string, unknown>,
  timezone: CalendarTimezone
): Promise<ToolOutcome> {
  const title = readString(args, "title", 200);
  const date = readString(args, "date", 10);
  if (!title || !date || !datePattern.test(date)) {
    return { summary: "Could not create the event: a valid title and date (YYYY-MM-DD) are required.", result: { ok: false } };
  }

  const formData = new FormData();
  formData.set("title", title);
  formData.set("description", readString(args, "description", 2000) ?? "");
  formData.set("location", readString(args, "location", 255) ?? "");
  formData.set("timezone", timezone);
  formData.set("confirmConflict", "true");

  const isAllDay = args.is_all_day === true;
  formData.set("isAllDay", String(isAllDay));

  const repeat = readString(args, "repeat", 10) ?? "none";
  if (!["none", "daily", "weekly", "monthly"].includes(repeat)) {
    return { summary: "Could not create the event: unsupported repeat value.", result: { ok: false } };
  }
  if (repeat === "none") {
    formData.set("recurrenceRule", "");
  } else {
    const weekdays = Array.isArray(args.weekdays)
      ? args.weekdays.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
    if (repeat === "weekly" && !weekdays.length) {
      return { summary: "Could not create the event: weekly repeats need at least one weekday (0=Sunday..6=Saturday).", result: { ok: false } };
    }
    formData.set("recurrenceRule", JSON.stringify({ frequency: repeat, weekdays }));
  }

  if (isAllDay) {
    formData.set("startDate", date);
    const endDate = readString(args, "end_date", 10);
    formData.set("endDate", endDate && datePattern.test(endDate) ? endDate : date);
  } else {
    const startTime = readString(args, "start_time", 5);
    const endTime = readString(args, "end_time", 5);
    if (!startTime || !endTime || !timePattern.test(startTime) || !timePattern.test(endTime)) {
      return { summary: "Could not create the event: start_time and end_time (HH:mm) are required for timed events.", result: { ok: false } };
    }
    formData.set("startLocal", `${date}T${startTime}`);
    formData.set("endLocal", `${date}T${endTime}`);
  }

  const result = await createCalendarEvent(formData);
  if (!result.ok) {
    return {
      summary: `Could not create the event (${result.code}).`,
      result: { ok: false, error: result.code },
    };
  }
  const repeatNote = repeat === "none" ? "" : `, repeating ${repeat}`;
  return {
    summary: `Created event “${title}” on ${date}${repeatNote}.`,
    result: { ok: true, title, date },
  };
}

async function runCreateTask(args: Record<string, unknown>): Promise<ToolOutcome> {
  const title = readString(args, "title", 200);
  if (!title) {
    return { summary: "Could not create the task: a title is required.", result: { ok: false } };
  }

  const formData = new FormData();
  formData.set("title", title);
  formData.set("description", readString(args, "description", 2000) ?? "");
  formData.set("projectId", "");
  formData.set("status", "TODO");
  formData.set("responseMode", "inline");

  const priority = readString(args, "priority", 10);
  formData.set("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority ?? "") ? priority! : "MEDIUM");
  const difficulty = readString(args, "difficulty", 10);
  formData.set("difficulty", ["EASY", "NORMAL", "HARD"].includes(difficulty ?? "") ? difficulty! : "NORMAL");

  const estimated = readInt(args, "estimated_minutes", 1, 1440);
  formData.set("estimatedMinutes", estimated === null ? "" : String(estimated));

  const dueDate = readString(args, "due_date", 10);
  formData.set("dueDate", dueDate && datePattern.test(dueDate) ? dueDate : "");

  const result = await createTask(formData);
  if (result.kind !== "status") {
    return { summary: "Could not create the task: the details were rejected.", result: { ok: false, error: result.message } };
  }
  return { summary: `Created task “${title}”.`, result: { ok: true, title } };
}

async function runCompleteTask(args: Record<string, unknown>): Promise<ToolOutcome> {
  const taskId = readString(args, "task_id", 64);
  if (!taskId || !uuidPattern.test(taskId)) {
    return { summary: "Could not complete the task: a valid task_id is required.", result: { ok: false } };
  }

  const formData = new FormData();
  formData.set("taskId", taskId);
  formData.set("nextStatus", "DONE");
  formData.set("responseMode", "inline");

  const result = await toggleTaskStatus(formData);
  if (result.kind !== "status") {
    return { summary: "Could not complete the task: it was not found in your workspace.", result: { ok: false, error: result.message } };
  }
  return { summary: "Marked the task as done.", result: { ok: true, task_id: taskId } };
}

async function runFindFreeSlots(
  args: Record<string, unknown>,
  ownerId: string,
  timezone: CalendarTimezone
): Promise<ToolOutcome> {
  const date = readString(args, "date", 10);
  if (!date || !datePattern.test(date)) {
    return { summary: "Could not search free time: a valid date (YYYY-MM-DD) is required.", result: { ok: false } };
  }
  const duration = readInt(args, "duration_minutes", 15, 600) ?? 60;

  const midnight = parseCalendarLocal(`${date}T00:00`, timezone);
  if (!midnight) {
    return { summary: "Could not search free time: that date is out of range.", result: { ok: false } };
  }
  const dayStart = midnight.getTime();
  const dayEnd = dayStart + DAY_MS;

  const { events } = await loadCalendarEvents(ownerId, midnight, new Date(dayEnd));
  const busy = events
    .filter((event) => !event.isAllDay)
    .map((event) => ({
      start: Math.max(dayStart, Date.parse(event.startsAt)),
      end: Math.min(dayEnd, Date.parse(event.endsAt)),
    }))
    .filter((slot) => slot.end > slot.start)
    .sort((a, b) => a.start - b.start);

  const free: { start: string; end: string }[] = [];
  let cursor = dayStart + FREE_DAY_START * 60_000;
  const limit = dayStart + FREE_DAY_END * 60_000;
  for (const slot of busy) {
    if (slot.start - cursor >= duration * 60_000) {
      free.push({
        start: formatCalendarLocal(new Date(cursor), timezone).slice(11, 16),
        end: formatCalendarLocal(new Date(Math.min(slot.start, limit)), timezone).slice(11, 16),
      });
    }
    cursor = Math.max(cursor, slot.end);
    if (cursor >= limit) break;
  }
  if (limit - cursor >= duration * 60_000 && free.length < 10) {
    free.push({
      start: formatCalendarLocal(new Date(cursor), timezone).slice(11, 16),
      end: formatCalendarLocal(new Date(limit), timezone).slice(11, 16),
    });
  }

  return {
    summary: free.length
      ? `Found ${free.length} free window${free.length === 1 ? "" : "s"} on ${date}.`
      : `No free ${duration}-minute window on ${date} between 07:00 and 22:00.`,
    result: { ok: true, date, free_slots: free.slice(0, 10) },
  };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: { ownerId: string; timezone: CalendarTimezone }
): Promise<ToolOutcome> {
  switch (name) {
    case "create_event":
      return runCreateEvent(args, context.timezone);
    case "create_task":
      return runCreateTask(args);
    case "complete_task":
      return runCompleteTask(args);
    case "find_free_slots":
      return runFindFreeSlots(args, context.ownerId, context.timezone);
    default:
      return { summary: `Unknown tool: ${name}.`, result: { ok: false, error: "unknown_tool" } };
  }
}

export async function executeToolSafe(
  name: string,
  args: Record<string, unknown>,
  context: { ownerId: string; timezone: CalendarTimezone }
): Promise<ToolOutcome> {
  try {
    return await executeTool(name, args, context);
  } catch {
    return { summary: "The tool could not run. Please try again.", result: { ok: false, error: "tool_failed" } };
  }
}
