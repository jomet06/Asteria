import { formatCalendarLocal, isCalendarDay, parseCalendarLocal, type CalendarTimezone } from "./date-time";

export type Recurrence = { frequency: "daily" | "weekly" | "monthly"; weekdays: number[]; until?: string; count?: number };
const DAY = 86_400_000;

export function parseRecurrence(value: unknown): Recurrence | null {
  if (typeof value !== "string" || value.length > 1000) throw new Error("Invalid recurrence");
  if (!value) return null;
  const rule = JSON.parse(value) as Recurrence;
  if (!rule || !["daily", "weekly", "monthly"].includes(rule.frequency) ||
    !Array.isArray(rule.weekdays) || rule.weekdays.length > 7 ||
    rule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    (rule.frequency === "weekly" && !rule.weekdays.length) ||
    (rule.until !== undefined && !isCalendarDay(rule.until)) ||
    (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 10000)) ||
    (rule.until !== undefined && rule.count !== undefined)) throw new Error("Invalid recurrence");
  return { frequency: rule.frequency, weekdays: [...new Set(rule.weekdays)].sort(), ...(rule.until ? { until: rule.until } : {}), ...(rule.count ? { count: rule.count } : {}) };
}

type Series = { startsAt: Date; endsAt: Date; timezone: CalendarTimezone; recurrenceRule: string | null };

// Supported zones have fixed UTC offsets. Scan at most the supported 1900–2100
// calendar, never materialize database rows. Missing monthly dates are skipped.
export function expandSeries(series: Series, from: Date, to: Date, limit = 501): { startsAt: Date; endsAt: Date; originalStart: Date }[] {
  if (!(from < to) || to.getTime() - from.getTime() > 740 * DAY) throw new Error("Invalid expansion range");
  const rule = parseRecurrence(series.recurrenceRule ?? "");
  const duration = series.endsAt.getTime() - series.startsAt.getTime();
  if (duration <= 0 || duration > 366 * DAY) throw new Error("Invalid duration");
  if (!rule) return series.startsAt < to && series.endsAt > from ? [{ startsAt: series.startsAt, endsAt: series.endsAt, originalStart: series.startsAt }] : [];
  const local = formatCalendarLocal(series.startsAt, series.timezone);
  const anchor = Date.parse(`${local.slice(0, 10)}T00:00:00Z`);
  const anchorDay = new Date(anchor).getUTCDate();
  const result: ReturnType<typeof expandSeries> = [];
  const firstIndex = Math.max(0, Math.floor((from.getTime() - duration - series.startsAt.getTime()) / DAY));
  let count = 0;
  if (rule.frequency === "daily") count = firstIndex;
  if (rule.frequency === "weekly" && firstIndex > 0) {
    const weekday = new Date(anchor).getUTCDay();
    count = Math.floor(firstIndex / 7) * rule.weekdays.length;
    for (let offset = 0; offset < firstIndex % 7; offset++) {
      if (rule.weekdays.includes((weekday + offset) % 7)) count++;
    }
    if (!rule.weekdays.includes(weekday)) count++;
  }
  const anchorDate = new Date(anchor);
  // Monthly iteration is at most 2,412 calendar months in supported years.
  const iterations = rule.frequency === "monthly" ? 2412 : 73414;
  for (let step = rule.frequency === "monthly" ? 0 : firstIndex; step <= iterations; step++) {
    const date = rule.frequency === "monthly"
      ? new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + step, anchorDay))
      : new Date(anchor + step * DAY);
    if (rule.frequency === "monthly" && date.getUTCDate() !== anchorDay) continue;
    const day = date.toISOString().slice(0, 10);
    if (day > "2100-12-31" || (rule.until && day > rule.until)) break;
    const startsAt = parseCalendarLocal(`${day}T${local.slice(11)}`, series.timezone);
    if (!startsAt || startsAt >= to) break;
    if (step !== 0 && rule.frequency === "weekly" && !rule.weekdays.includes(date.getUTCDay())) continue;
    if (++count > (rule.count ?? 100000)) break;
    const endsAt = new Date(startsAt.getTime() + duration);
    if (endsAt > from) result.push({ startsAt, endsAt, originalStart: startsAt });
    if (result.length >= limit) break;
  }
  return result;
}

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}
