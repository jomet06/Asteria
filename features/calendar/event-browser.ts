import type { CalendarEventView } from "./data";
import { calendarMonthRange, formatCalendarLocal, parseCalendarLocal, type CalendarTimezone } from "./date-time";
import { parseRecurrence } from "./recurrence";
import { readEventFields } from "./validation";

export const EVENT_KINDS = {
  event: "Personal event", google: "Google Calendar", deadline: "Task deadline",
  planner: "Daily plan", block: "Time block",
} as const;

export type EventFilters = {
  query: string;
  kind: "all" | keyof typeof EVENT_KINDS;
  timing: "all" | "timed" | "all-day";
  sort: "earliest" | "latest" | "title";
};

export const DEFAULT_EVENT_FILTERS: EventFilters = { query: "", kind: "all", timing: "all", sort: "earliest" };

export function eventsInMonth(events: CalendarEventView[], month: string, timezone: CalendarTimezone) {
  const { from, to } = calendarMonthRange(month, timezone);
  const nextMonth = formatCalendarLocal(to, timezone).slice(0, 7);
  return events.filter((event) => event.isAllDay
    ? formatCalendarLocal(event.startsAt, event.timezone).slice(0, 10) < `${nextMonth}-01` && formatCalendarLocal(event.endsAt, event.timezone).slice(0, 10) > `${month}-01`
    : Date.parse(event.startsAt) < to.getTime() && Date.parse(event.endsAt) > from.getTime());
}

export function filterMonthEvents(events: CalendarEventView[], filters: EventFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return events.filter((event) =>
    (!query || `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLocaleLowerCase().includes(query)) &&
    (filters.kind === "all" || (event.kind ?? "event") === filters.kind) &&
    (filters.timing === "all" || event.isAllDay === (filters.timing === "all-day"))
  ).sort((a, b) => {
    if (filters.sort === "title") return a.title.localeCompare(b.title) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
    const order = a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
    return filters.sort === "latest" ? -order : order;
  });
}

export function eventDefaults(day: string, timezone: CalendarTimezone, now: Date) {
  const localToday = formatCalendarLocal(now, timezone).slice(0, 10);
  const start = day === localToday
    ? new Date(Math.ceil(now.getTime() / 1_800_000) * 1_800_000)
    : parseCalendarLocal(`${day}T09:00`, timezone);
  if (!start) throw new Error("Invalid selected calendar date");
  return { start: formatCalendarLocal(start, timezone), end: formatCalendarLocal(new Date(start.getTime() + 3_600_000), timezone) };
}

/** Uses the same parser as server mutations; no fabricated dates or writes. */
export function eventFormError(data: FormData): string | null {
  if (!String(data.get("title") ?? "").trim()) return "Enter an event title.";
  const allDay = data.get("isAllDay") === "true";
  const start = String(data.get(allDay ? "startDate" : "startLocal") ?? "");
  const end = String(data.get(allDay ? "endDate" : "endLocal") ?? "");
  if (!start) return "Choose a start date and time.";
  if (end && (allDay ? end < start : end <= start)) return allDay ? "End date cannot be before the start date." : "End time must be after the start time.";
  try {
    const rule = parseRecurrence(data.get("recurrenceRule") ?? "");
    if (rule?.until && rule.until < start.slice(0, 10)) return "The last occurrence date cannot be before the start date.";
  } catch { return "Check the repeat settings: choose weekdays, a valid end date, or a count from 1 to 10,000."; }
  return readEventFields(data) ? null : "Check the event dates, timezone, and field lengths. Events can span at most 366 days.";
}
