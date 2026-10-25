export class GoogleImportError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function readCalendarSelection(values: FormDataEntryValue[], targetId: string | null) {
  if (values.some((value) => typeof value !== "string" || !value.trim() || value.length > 512)) {
    throw new GoogleImportError("invalid_calendars");
  }
  const ids = [...new Set(values as string[])];
  if (!ids.length) throw new GoogleImportError("no_calendars_selected");
  if (ids.length > 3) throw new GoogleImportError("too_many_calendars");
  if (targetId && ids.includes(targetId)) throw new GoogleImportError("invalid_calendars");
  return ids;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GoogleImportError("invalid_google_data");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new GoogleImportError("invalid_google_data");
    return null;
  }
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new GoogleImportError("invalid_google_data");
  }
  return value;
}

function day(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new GoogleImportError("invalid_google_data");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new GoogleImportError("invalid_google_data");
  }
  return value;
}

function instant(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(value)) {
    throw new GoogleImportError("invalid_google_data");
  }
  day(value.slice(0, 10));
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new GoogleImportError("invalid_google_data");
  return result;
}

export function normalizeGoogleEvent(value: unknown) {
  const item = record(value);
  const googleEventId = text(item.id, 512, true)!;
  if (item.status === "cancelled") return null; // Cancelled instances may omit their dates.
  if (item.status != null && item.status !== "confirmed" && item.status !== "tentative") {
    throw new GoogleImportError("invalid_google_data");
  }
  const start = record(item.start);
  const end = record(item.end);
  const isAllDay = start.date != null || end.date != null;
  if (isAllDay && (start.dateTime != null || end.dateTime != null)) {
    throw new GoogleImportError("invalid_google_data");
  }
  const startsAt = isAllDay ? new Date(`${day(start.date)}T00:00:00Z`) : instant(start.dateTime);
  const endsAt = isAllDay ? new Date(`${day(end.date)}T00:00:00Z`) : instant(end.dateTime);
  if (endsAt <= startsAt) throw new GoogleImportError("invalid_google_data");
  const timezone = text(start.timeZone ?? end.timeZone, 64) ?? "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(startsAt); }
  catch { throw new GoogleImportError("invalid_google_data"); }
  const htmlLink = text(item.htmlLink, 2000);
  if (htmlLink) {
    let url: URL;
    try { url = new URL(htmlLink); } catch { throw new GoogleImportError("invalid_google_data"); }
    if (url.protocol !== "https:" || url.username || url.password ||
        !["calendar.google.com", "www.google.com"].includes(url.hostname)) {
      throw new GoogleImportError("invalid_google_data");
    }
  }
  return {
    googleEventId,
    title: text(item.summary, 500)?.trim() || "(Untitled event)",
    description: text(item.description, 1_000_000),
    location: text(item.location, 1000),
    startsAt, endsAt, timezone, isAllDay, htmlLink,
    googleUpdatedAt: item.updated == null ? null : instant(item.updated),
  };
}

export type NormalizedGoogleEvent = NonNullable<ReturnType<typeof normalizeGoogleEvent>>;

export function readGooglePage(value: unknown) {
  const page = record(value);
  if (page.items != null && !Array.isArray(page.items)) throw new GoogleImportError("invalid_google_data");
  const nextPageToken = text(page.nextPageToken, 4096) ?? undefined;
  if (nextPageToken === "") throw new GoogleImportError("invalid_google_data");
  return { items: (page.items ?? []) as unknown[], nextPageToken };
}
