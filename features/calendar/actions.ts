
"use server";

import { revalidatePath } from "next/cache";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

import {
  isCalendarTimezone,
  parseCalendarLocal,
  parseAllDayRange,
} from "./date-time";

export type CalendarActionResult =
  | {
      ok: true;
      code: "created" | "updated" | "deleted";
    }
  | {
      ok: false;
      code: "invalid_input" | "not_found";
    };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readEventId(
  formData: FormData
): string | null {
  const value = formData.get("eventId");

  return (
    typeof value === "string" &&
    uuidPattern.test(value)
  )
    ? value
    : null;
}

function readEventFields(
  formData: FormData
) {
  const titleValue = formData.get("title");
  const descriptionValue =
    formData.get("description");
  const locationValue =
    formData.get("location");
  const timezoneValue =
    formData.get("timezone");
  const allDayValue =
    formData.get("isAllDay");

  if (
    typeof titleValue !== "string" ||
    typeof descriptionValue !== "string" ||
    typeof locationValue !== "string" ||
    !isCalendarTimezone(timezoneValue) ||
    (
      allDayValue !== "true" &&
      allDayValue !== "false"
    )
  ) {
    return null;
  }

  const title = titleValue.trim();
  const description =
    descriptionValue.trim();
  const location = locationValue.trim();

  if (
    title.length < 1 ||
    title.length > 200 ||
    description.length > 2000 ||
    location.length > 255
  ) {
    return null;
  }

  const isAllDay = allDayValue === "true";

  let startsAt: Date;
  let endsAt: Date;

  if (isAllDay) {
    const range = parseAllDayRange(
      formData.get("startDate"),
      formData.get("endDate"),
      timezoneValue
    );

    if (!range) return null;

    startsAt = range.startsAt;
    endsAt = range.endsAt;
  } else {
    const start = parseCalendarLocal(
      formData.get("startLocal"),
      timezoneValue
    );

    const end = parseCalendarLocal(
      formData.get("endLocal"),
      timezoneValue
    );

    if (
      !start ||
      !end ||
      end.getTime() <= start.getTime() ||
      end.getTime() - start.getTime() >
        366 * 86_400_000
    ) {
      return null;
    }

    startsAt = start;
    endsAt = end;
  }

  return {
    title,
    description: description || null,
    location: location || null,
    timezone: timezoneValue,
    isAllDay,
    startsAt,
    endsAt,
  };
}

function refreshCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// ========================================
// CREATE EVENT
// ========================================

export async function createCalendarEvent(
  formData: FormData
): Promise<CalendarActionResult> {
  const { user } = await getMyAccount();

  const fields = readEventFields(formData);

  if (!fields) {
    return {
      ok: false,
      code: "invalid_input",
    };
  }

  await prisma.calendarEvent.create({
    data: {
      ...fields,
      ownerId: user.id,
      recurrenceRule: null,
    },
  });

  refreshCalendar();

  return {
    ok: true,
    code: "created",
  };
}

// ========================================
// UPDATE EVENT
// ========================================

export async function updateCalendarEvent(
  formData: FormData
): Promise<CalendarActionResult> {
  const { user } = await getMyAccount();

  const eventId = readEventId(formData);
  const fields = readEventFields(formData);

  if (!eventId || !fields) {
    return {
      ok: false,
      code: "invalid_input",
    };
  }

  // M3.2 edits standalone events only.
  // Recurring-event edits belong to M3.4.
  const result =
    await prisma.calendarEvent.updateMany({
      where: {
        id: eventId,
        ownerId: user.id,
        recurrenceRule: null,
      },
      data: fields,
    });

  if (result.count === 0) {
    return {
      ok: false,
      code: "not_found",
    };
  }

  refreshCalendar();

  return {
    ok: true,
    code: "updated",
  };
}

// ========================================
// DELETE EVENT
// ========================================

export async function deleteCalendarEvent(
  formData: FormData
): Promise<CalendarActionResult> {
  const { user } = await getMyAccount();

  const eventId = readEventId(formData);

  if (!eventId) {
    return {
      ok: false,
      code: "invalid_input",
    };
  }

  const result =
    await prisma.calendarEvent.deleteMany({
      where: {
        id: eventId,
        ownerId: user.id,
        recurrenceRule: null,
      },
    });

  if (result.count === 0) {
    return {
      ok: false,
      code: "not_found",
    };
  }

  refreshCalendar();

  return {
    ok: true,
    code: "deleted",
  };
}
