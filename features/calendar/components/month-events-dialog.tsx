"use client";

import { useId, useState, type RefObject } from "react";
import { CalendarDays, ChevronRight, Clock3, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/features/tasks/components/workspace-dialog";
import type { CalendarEventView } from "../data";
import { formatCalendarLocal, type CalendarTimezone } from "../date-time";
import { DEFAULT_EVENT_FILTERS, EVENT_KINDS, filterMonthEvents, type EventFilters } from "../event-browser";

const controlClass = "h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const kindDot = { event: "bg-primary", google: "bg-sky-500", deadline: "bg-amber-500", planner: "bg-emerald-500", block: "bg-violet-500" };

export function MonthEventsDialog({ open, onOpenChange, monthLabel, events, timezone, truncated, onSelect, scheduleLabel, triggerRef }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthLabel: string;
  events: CalendarEventView[];
  timezone: CalendarTimezone;
  truncated: boolean;
  onSelect: (event: CalendarEventView) => void;
  scheduleLabel: (event: CalendarEventView) => string;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const id = useId();
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const filtered = filterMonthEvents(events, filters);
  const active = !!filters.query.trim() || filters.kind !== "all" || filters.timing !== "all" || filters.sort !== "earliest";
  function update(patch: Partial<EventFilters>) { setFilters((current) => ({ ...current, ...patch })); }

  return <WorkspaceDialog open={open} onOpenChange={onOpenChange} title="Events this month"
    description={`${monthLabel} · ${timezone}. Search your schedule and open an event for details.`} size="wide" returnFocusRef={triggerRef}>
    <div className="sticky top-0 z-10 space-y-3 bg-background pb-4">
      <div className="relative">
        <label htmlFor={`${id}-search`} className="sr-only">Search events</label>
        <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <input id={`${id}-search`} type="search" autoComplete="off" maxLength={200} value={filters.query}
          onChange={(event) => update({ query: event.target.value })} placeholder="Search title, location, or description…" className={`${controlClass} pl-10`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 min-w-0 space-y-1 text-xs font-medium text-muted-foreground sm:col-span-1">Event type
          <select aria-label="Event type" value={filters.kind} onChange={(event) => update({ kind: event.target.value as EventFilters["kind"] })} className={controlClass}>
            <option value="all">All types</option>{Object.entries(EVENT_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">Schedule
          <select aria-label="Schedule" value={filters.timing} onChange={(event) => update({ timing: event.target.value as EventFilters["timing"] })} className={controlClass}>
            <option value="all">All schedules</option><option value="timed">Timed events</option><option value="all-day">All-day events</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">Sort by
          <select aria-label="Sort by" value={filters.sort} onChange={(event) => update({ sort: event.target.value as EventFilters["sort"] })} className={controlClass}>
            <option value="earliest">Earliest first</option><option value="latest">Latest first</option><option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{filtered.length} of {events.length}{truncated ? "+" : ""} events</p>
        {active && <Button type="button" variant="ghost" onClick={() => setFilters(DEFAULT_EVENT_FILTERS)} className="gap-1.5 text-xs"><X className="size-3.5" />Clear filters</Button>}
      </div>
      {truncated && <p role="status" className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">This calendar reached its event limit. Only loaded events are included.</p>}
    </div>
    {filtered.length ? <ul aria-label="Events this month" className="space-y-2 pb-2">
      {filtered.map((event) => {
        const kind = event.kind ?? "event";
        const day = formatCalendarLocal(event.startsAt, event.isAllDay ? event.timezone : timezone).slice(0, 10);
        return <li key={event.id} className="min-w-0">
          <button type="button" onClick={() => onSelect(event)} aria-label={`View event: ${event.title}`}
            className="flex w-full min-w-0 items-start gap-3 rounded-xl border bg-card/50 p-3 text-left outline-none transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
            <time dateTime={day} className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted px-1 py-2 text-center">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">{new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00Z`))}</span>
              <span className="text-lg font-semibold leading-6">{Number(day.slice(8))}</span>
            </time>
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere]">{event.title}</span>
              <span className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 size-3.5 shrink-0" /><span>{scheduleLabel(event)}</span></span>
              {event.location && <span className="flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{event.location}</span></span>}
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`size-1.5 shrink-0 rounded-full ${kindDot[kind]}`} />{EVENT_KINDS[kind]}{kind === "google" || kind === "deadline" || kind === "planner" ? " · Read-only" : ""}</span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>;
      })}
    </ul> : <div className="rounded-xl border border-dashed px-5 py-12 text-center">
      <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="font-medium">{events.length ? "No matching events" : "No events this month"}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{events.length ? "Try another search or clear your filters." : "Close this window and choose New event to plan something."}</p>
      {active && <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>Reset search and filters</Button>}
    </div>}
  </WorkspaceDialog>;
}
