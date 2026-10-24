import { isCalendarTimezone, parseCalendarLocal, parseAllDayRange, formatCalendarLocal } from "./date-time";
import { parseRecurrence } from "./recurrence";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readEventId(
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

export function readEventFields(
  formData: FormData
) {
  if (formData.has("ownerId")) return null;
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
    const startDay = formData.get("startDate");
    const endDayInput = formData.get("endDate");
    // Recurring all-day series may omit the end date and default to
    // one-day instances instead of being blocked by validation.
    const recurring =
      typeof formData.get("recurrenceRule") === "string" &&
      formData.get("recurrenceRule") !== "";
    const endDay =
      typeof endDayInput === "string" && endDayInput !== ""
        ? endDayInput
        : recurring
          ? startDay
          : endDayInput;
    const range = parseAllDayRange(
      startDay,
      endDay,
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

  let recurrenceRule: string | null;
  try {
    const rule = parseRecurrence(formData.get("recurrenceRule") ?? "");
    if (rule?.until && rule.until < formatCalendarLocal(startsAt, timezoneValue).slice(0, 10)) return null;
    recurrenceRule = rule ? JSON.stringify(rule) : null;
  } catch { return null; }
  const taskId = formData.get("taskId") || null;
  if (taskId !== null && (typeof taskId !== "string" || !uuidPattern.test(taskId))) return null;
  return {
    recurrenceRule,
    taskId,
    title,
    description: description || null,
    location: location || null,
    timezone: timezoneValue,
    isAllDay,
    startsAt,
    endsAt,
  };
}

