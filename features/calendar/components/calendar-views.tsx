"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CalendarEventView } from "../data";
import {
  formatCalendarLocal,
  isCalendarDay,
  parseCalendarLocal,
  previousAllDayDate,
  type CalendarTimezone,
} from "../date-time";

export type CalendarDisplayView = "month" | "week" | "day";

type Props = {
  view: CalendarDisplayView;
  selectedDate: string;
  today: string;
  timezone: CalendarTimezone;
  events: CalendarEventView[];
  truncated: boolean;
};

const DAY_MS = 86_400_000;
const HOUR_HEIGHT = 48;
const hours = Array.from({ length: 24 }, (_, i) => i);
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

function calendarHref(view: CalendarDisplayView, day: string): string {
  return `/calendar?month=${day.slice(0, 7)}&date=${day}&view=${view}`;
}

function shortDate(day: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function longDate(day: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

// An event overlaps [dayStart, nextDayStart). For all-day events,
// use the event's own calendar dates, not the viewer's UTC offset.
function occursOn(
  event: CalendarEventView,
  day: string,
  timezone: CalendarTimezone
): boolean {
  if (event.isAllDay) {
    const first = formatCalendarLocal(event.startsAt, event.timezone).slice(0, 10);
    const lastExclusive = formatCalendarLocal(event.endsAt, event.timezone).slice(0, 10);
    return first <= day && day < lastExclusive;
  }

  const start = parseCalendarLocal(`${day}T00:00`, timezone);
  const end = parseCalendarLocal(`${addDays(day, 1)}T00:00`, timezone);
  if (!start || !end) return false;

  return Date.parse(event.startsAt) < end.getTime() &&
    Date.parse(event.endsAt) > start.getTime();
}

function eventLabel(event: CalendarEventView, timezone: CalendarTimezone): string {
  if (event.isAllDay) return "All day";
  return formatCalendarLocal(event.startsAt, timezone).slice(11, 16);
}

type Segment = {
  event: CalendarEventView;
  start: number;
  end: number;
  lane: number;
  laneCount: number;
};

// Allocate side-by-side lanes so simultaneous events are still clickable.
function timedSegments(
  events: CalendarEventView[],
  day: string,
  timezone: CalendarTimezone
): Segment[] {
  const midnight = parseCalendarLocal(`${day}T00:00`, timezone);
  if (!midnight) return [];
  const dayStart = midnight.getTime();
  const dayEnd = dayStart + DAY_MS;

  const pending = events
    .filter((event) => !event.isAllDay && occursOn(event, day, timezone))
    .map((event) => ({
      event,
      start: Math.max(0, (Math.max(Date.parse(event.startsAt), dayStart) - dayStart) / 60_000),
      end: Math.min(1440, (Math.min(Date.parse(event.endsAt), dayEnd) - dayStart) / 60_000),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: Segment[] = [];
  let group: typeof pending = [];
  let maxEnd = -1;

  function flush() {
    if (!group.length) return;
    const laneEnds: number[] = [];
    const placed = group.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      return { ...item, lane };
    });
    for (const item of placed) {
      result.push({ ...item, laneCount: laneEnds.length });
    }
    group = [];
    maxEnd = -1;
  }

  for (const item of pending) {
    if (group.length && item.start >= maxEnd) flush();
    group.push(item);
    maxEnd = Math.max(maxEnd, item.end);
  }
  flush();
  return result;
}

function EventChip({
  event,
  timezone,
  onSelect,
  compact = false,
}: {
  event: CalendarEventView;
  timezone: CalendarTimezone;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={event.title}
      data-kind={event.kind}
      aria-label={`View event: ${event.title}`}
      onClick={() => onSelect(event.id)}
      className="block w-full min-w-0 rounded-md border data-[kind=deadline]:border-amber-500 data-[kind=deadline]:bg-amber-500/15 data-[kind=planner]:border-emerald-500 data-[kind=planner]:bg-emerald-500/15 data-[kind=block]:border-violet-500 data-[kind=block]:bg-violet-500/15 data-[kind=google]:border-sky-500 data-[kind=google]:bg-sky-500/15 border-primary/25 bg-primary/10 px-1.5 py-1 text-left text-xs text-foreground outline-none hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block truncate font-medium">
        {!compact && `${eventLabel(event, timezone)} · `}{event.title}
      </span>
    </button>
  );
}

function MonthGrid({
  month,
  today,
  timezone,
  events,
  onSelect,
}: {
  month: string;
  today: string;
  timezone: CalendarTimezone;
  events: CalendarEventView[];
  onSelect: (id: string) => void;
}) {
  const first = mondayOf(`${month}-01`);
  const days = Array.from({ length: 35 }, (_, i) => addDays(first, i));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekdayLabels.map((name) => (
            <div key={name} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const daily = events.filter((event) => occursOn(event, day, timezone));
            return (
              <div
                key={day}
                className={`min-h-32 border-b border-r p-1.5 sm:min-h-36 ${day.slice(0, 7) !== month ? "bg-muted/25" : ""}`}
              >
                <Link
                  href={calendarHref("day", day)}
                  aria-label={`Open ${longDate(day)} in day view`}
                  className={`mb-1 inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold hover:bg-muted ${day === today ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                >
                  {Number(day.slice(8))}
                </Link>
                <div className="space-y-1">
                  {daily.slice(0, 3).map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      timezone={timezone}
                      onSelect={onSelect}
                    />
                  ))}
                  {daily.length > 3 && (
                    <Link
                      href={calendarHref("day", day)}
                      className="block px-1 text-xs font-medium text-primary hover:underline"
                    >
                      +{daily.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  today,
  timezone,
  events,
  onSelect,
}: {
  days: string[];
  today: string;
  timezone: CalendarTimezone;
  events: CalendarEventView[];
  onSelect: (id: string) => void;
}) {
  const gridColumns = `64px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className={days.length === 7 ? "min-w-[940px]" : "min-w-[320px]"}>
        <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
          <div className="border-b bg-muted/30" />
          {days.map((day) => (
            <Link
              key={day}
              href={calendarHref("day", day)}
              className={`border-b border-l px-2 py-3 text-center text-sm font-semibold hover:bg-muted/50 ${day === today ? "text-primary" : ""}`}
            >
              {shortDate(day)}
              <span className="ml-1 text-xs text-muted-foreground">
                {weekdayLabels[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}
              </span>
            </Link>
          ))}
          <div className="border-b bg-muted/30 px-1 py-2 text-center text-[10px] text-muted-foreground">All day</div>
          {days.map((day) => (
            <div key={`all-${day}`} className="min-h-12 space-y-1 border-b border-l p-1">
              {events.filter((event) => event.isAllDay && occursOn(event, day, timezone)).map((event) => (
                <EventChip key={event.id} event={event} timezone={timezone} onSelect={onSelect} compact />
              ))}
            </div>
          ))}
          <div className="bg-muted/20">
            {hours.map((hour) => (
              <div key={hour} className="h-12 border-b pr-2 pt-1 text-right text-[10px] text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={`timeline-${day}`} className="relative border-l" style={{ height: 24 * HOUR_HEIGHT }}>
              {hours.map((hour) => (
                <div key={hour} className="h-12 border-b border-border/60" />
              ))}
              {timedSegments(events, day, timezone).map(({ event, start, end, lane, laneCount }) => (
                <button
                  key={event.id}
                  type="button"
                  title={`${event.title} · ${eventLabel(event, timezone)}`}
                  aria-label={`View event: ${event.title}`}
                  onClick={() => onSelect(event.id)}
                  data-kind={event.kind}
                  className="data-[kind=deadline]:border-amber-500 data-[kind=deadline]:bg-amber-500/20 data-[kind=block]:border-violet-500 data-[kind=block]:bg-violet-500/20 data-[kind=google]:border-sky-500 data-[kind=google]:bg-sky-500/20 absolute z-10 overflow-hidden rounded-md border border-primary/35 bg-primary/15 px-1 py-0.5 text-left text-[11px] leading-tight text-foreground outline-none hover:bg-primary/25 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    top: (start / 60) * HOUR_HEIGHT,
                    height: Math.max(20, ((end - start) / 60) * HOUR_HEIGHT),
                    left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                    width: `calc(${100 / laneCount}% - 4px)`,
                  }}
                >
                  <span className="block truncate font-semibold">{event.title}</span>
                  <span className="block truncate">{eventLabel(event, timezone)} ? {formatCalendarLocal(event.endsAt, timezone).slice(11, 16)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarViews({
  view,
  selectedDate,
  today,
  timezone,
  events,
  truncated,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const month = selectedDate.slice(0, 7);
  const weekStart = mondayOf(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayedDays = view === "week" ? weekDays : [selectedDate];

  const previous = view === "month"
    ? `${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7)}-01`
    : addDays(selectedDate, view === "week" ? -7 : -1);
  const next = view === "month"
    ? `${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)).toISOString().slice(0, 7)}-01`
    : addDays(selectedDate, view === "week" ? 7 : 1);

  const heading = view === "month"
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${month}-01T00:00:00Z`))
    : view === "week"
      ? `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`
      : longDate(selectedDate);

  return (
    <section aria-label="Visual calendar" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-5 text-primary" />
          <h2 className="text-base font-semibold sm:text-lg">{heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5" aria-label="Calendar display mode">
            {(["month", "week", "day"] as const).map((mode) => (
              <Link
                key={mode}
                href={calendarHref(mode, selectedDate)}
                aria-current={view === mode ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-xs font-medium capitalize ${view === mode ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`}
              >
                {mode}
              </Link>
            ))}
          </div>
          <input
            type="date"
            aria-label="Go to date"
            min="1900-01-01"
            max="2100-12-31"
            value={selectedDate}
            onChange={(event) => {
              if (isCalendarDay(event.target.value)) router.push(calendarHref(view, event.target.value));
            }}
            className="min-h-10 rounded-lg border bg-background px-2 text-xs"
          />
          <Link href={calendarHref(view, today)} className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted">
            Today
          </Link>
          <Link href={calendarHref(view, isCalendarDay(previous) ? previous : selectedDate)} aria-disabled={!isCalendarDay(previous)} aria-label={`Previous ${view}`} className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={calendarHref(view, isCalendarDay(next) ? next : selectedDate)} aria-disabled={!isCalendarDay(next)} aria-label={`Next ${view}`} className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {truncated && (
        <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          This period contains more than 500 events. Some items are omitted. Event, deadline and planner lists each have a 500-item limit.
        </p>
      )}

      <p className="text-xs text-muted-foreground">Events ? Amber: task deadlines ? Green: daily plans ? Violet: task time blocks</p>
      {events.length === 0 && <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">No events, deadlines or plans in this period.</p>}
      {view === "month" ? (
        <MonthGrid month={month} today={today} timezone={timezone} events={events} onSelect={setSelectedId} />
      ) : (
        <TimeGrid days={displayedDays} today={today} timezone={timezone} events={events} onSelect={setSelectedId} />
      )}

      {selected && (
        <section aria-label="Selected event details" className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedId(null)} aria-label="Close event details">
              <X className="size-4" />
            </Button>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            {selected.isAllDay
              ? `${formatCalendarLocal(selected.startsAt, selected.timezone).slice(0, 10)} – ${previousAllDayDate(selected.endsAt, selected.timezone)} · All day`
              : `${formatCalendarLocal(selected.startsAt, timezone).replace("T", " ")} – ${formatCalendarLocal(selected.endsAt, timezone).replace("T", " ")} (${timezone})`}
          </p>
          {selected.location && <p className="flex items-center gap-2 text-sm"><MapPin className="size-4" />{selected.location}</p>}
          {selected.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p>}
          <a href={selected.href ?? `${calendarHref(view, formatCalendarLocal(selected.startsAt, timezone).slice(0, 10))}#event-manager`} className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            {selected.kind === "google" ? "Open in Google Calendar" : selected.href ? "Open original task or planner" : "Manage events (edit or delete)"}
          </a>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Times are displayed in {timezone}. Open an event to inspect its details; use the event manager below to edit or delete it.
      </p>
    </section>
  );
}
