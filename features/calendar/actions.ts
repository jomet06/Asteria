"use server";

import { revalidatePath } from "next/cache";
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";
import { readEventFields, readEventId } from "./validation";
import { expandSeries, overlaps } from "./recurrence";
import { loadCalendarEvents } from "./data";
import { readCalendarTimezone } from "./date-time";
import { deleteEventFromGoogleAfterRemoval, syncEventToGoogle } from "./google/push";

export type CalendarActionResult =
  | { ok: true; code: "created" | "updated" | "deleted" }
  | { ok: false; code: "invalid_input" | "not_found" | "conflict"; message?: string };
const invalid: CalendarActionResult = { ok: false, code: "invalid_input" };
const missing: CalendarActionResult = { ok: false, code: "not_found" };

function refreshCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

async function conflictWarning(ownerId: string, fields: NonNullable<ReturnType<typeof readEventFields>>, data: FormData, excludeId?: string, occurrence?: Date): Promise<CalendarActionResult | null> {
  if (data.get("confirmConflict") === "true") return null;
  const from = fields.startsAt;
  const to = new Date(Math.max(fields.endsAt.getTime(), from.getTime() + (fields.recurrenceRule ? 366 : 0) * 86400000));
  const existing = await loadCalendarEvents(ownerId, from, to);
  const proposed = expandSeries({ ...fields, timezone: readCalendarTimezone(fields.timezone) }, from, to);
  const selfConflict = proposed.some((item, index) => index > 0 && overlaps(proposed[index - 1], item));
  const conflict = selfConflict || proposed.some((candidate) => existing.events.some((event) => {
    if (event.seriesId === excludeId && (!occurrence || event.originalStart === occurrence.toISOString())) return false;
    return overlaps(candidate, { startsAt: new Date(event.startsAt), endsAt: new Date(event.endsAt) });
  }));
  if (conflict || existing.truncated || proposed.length > 500) return { ok: false, code: "conflict", message: conflict ? "This schedule overlaps an existing event. Save again to continue." : "Conflict checking reached its limit. Save again to continue." };
  return null;
}

export async function createCalendarEvent(data: FormData): Promise<CalendarActionResult> {
  const { user } = await getMyAccount();
  const fields = readEventFields(data);
  if (!fields) return invalid;
  if (fields.taskId && !await prisma.task.findFirst({ where: { id: fields.taskId, ownerId: user.id }, select: { id: true } })) return missing;
  const warning = await conflictWarning(user.id, fields, data);
  if (warning) return warning;
  const created = await prisma.calendarEvent.create({ data: { ...fields, ownerId: user.id } });
  refreshCalendar();
  await syncEventToGoogle(user.id, created.id);
  return { ok: true, code: "created" };
}

function occurrenceDate(data: FormData): Date | null {
  const raw = data.get("originalStart");
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) && date.toISOString() === raw ? date : null;
}

export async function updateCalendarEvent(data: FormData): Promise<CalendarActionResult> {
  return mutateEvent(data, false);
}
export async function deleteCalendarEvent(data: FormData): Promise<CalendarActionResult> {
  return mutateEvent(data, true);
}

async function mutateEvent(data: FormData, remove: boolean): Promise<CalendarActionResult> {
  const { user } = await getMyAccount();
  const id = readEventId(data);
  const fields = remove ? null : readEventFields(data);
  const scope = data.get("scope") ?? "series";
  if (!id || data.has("ownerId") || (!remove && !fields) || !["series", "occurrence"].includes(String(scope))) return invalid;
  const parent = await prisma.calendarEvent.findFirst({ where: { id, ownerId: user.id, parentId: null } });
  if (!parent) return missing;
  const originalStart = scope === "occurrence" ? occurrenceDate(data) : null;
  if (scope === "occurrence") {
    if (!originalStart || !parent.recurrenceRule) return invalid;
    const matches = expandSeries({ ...parent, timezone: readCalendarTimezone(parent.timezone) }, originalStart, new Date(originalStart.getTime() + 1));
    if (!matches.some((item) => item.startsAt.getTime() === originalStart.getTime())) return invalid;
    if (fields && fields.taskId !== parent.taskId) return invalid;
  }
  if (fields) {
    if (fields.taskId && !await prisma.task.findFirst({ where: { id: fields.taskId, ownerId: user.id }, select: { id: true } })) return missing;
    const warning = await conflictWarning(user.id, { ...fields, recurrenceRule: originalStart ? null : fields.recurrenceRule }, data, id, originalStart ?? undefined);
    if (warning) return warning;
  }
  let pushedGoogleEventId: string | null = null;
  const result = await prisma.$transaction(async (tx) => {
    // Lock the owned series to serialize series edits and occurrence exceptions.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM public.calendar_events WHERE id = ${id}::uuid AND owner_id = ${user.id}::uuid FOR UPDATE`;
    if (!locked.length) return missing;
    const current = await tx.calendarEvent.findFirst({ where: { id, ownerId: user.id, parentId: null } });
    if (!current) return missing;
    pushedGoogleEventId = current.googleEventId;
    if (originalStart) {
      if (!current.recurrenceRule) return invalid;
      const matches = expandSeries({ ...current, timezone: readCalendarTimezone(current.timezone) }, originalStart, new Date(originalStart.getTime() + 1));
      if (!matches.some((item) => item.startsAt.getTime() === originalStart.getTime()) || (fields && fields.taskId !== current.taskId)) return invalid;
      const existingException = await tx.calendarEvent.findFirst({ where: { parentId: id, ownerId: user.id, originalStart } });
      if (!existingException && await tx.calendarEvent.count({ where: { parentId: id, ownerId: user.id } }) >= 500) return invalid;
      const { title, description, location, startsAt, endsAt, timezone, isAllDay, taskId } = fields ?? current;
      const exception = { title, description, location, startsAt, endsAt, timezone, isAllDay, taskId, recurrenceRule: null, isCancelled: remove };
      await tx.calendarEvent.upsert({ where: { parentId_originalStart: { parentId: id, originalStart } }, create: { ...exception, parentId: id, originalStart, ownerId: user.id }, update: exception });
    } else if (remove) {
      await tx.calendarEvent.deleteMany({ where: { id, ownerId: user.id } });
    } else {
      await tx.calendarEvent.deleteMany({ where: { parentId: id, ownerId: user.id } });
      await tx.calendarEvent.updateMany({ where: { id, ownerId: user.id }, data: fields! });
    }
    return { ok: true, code: remove ? "deleted" : "updated" } as CalendarActionResult;
  });
  if (result.ok) {
    refreshCalendar();
    // Two-way sync never blocks or fails the local result.
    if (remove) await deleteEventFromGoogleAfterRemoval(user.id, pushedGoogleEventId);
    else if (!originalStart) await syncEventToGoogle(user.id, id);
  }
  return result;
}
