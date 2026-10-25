
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import {
  AlignLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  ListFilter,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  WorkspaceDialog,
} from "@/features/tasks/components/workspace-dialog";

import { parseRecurrence } from "../recurrence";
import { eventDefaults, eventFormError, eventsInMonth } from "../event-browser";
import { MonthEventsDialog } from "./month-events-dialog";
import { EventDateField, EventTimeField } from "./event-schedule-field";

import type {
  CalendarActionResult,
} from "../actions";

import type {
  CalendarEventView,
} from "../data";

import {
  CALENDAR_TIMEZONES,
  formatCalendarLocal,
  previousAllDayDate,
  parseCalendarLocal,
  isCalendarDay,
  type CalendarTimezone,
} from "../date-time";

import {
  CalendarViews,
  type CalendarDisplayView,
} from "./calendar-views";

type CalendarAction = (
  data: FormData
) => Promise<CalendarActionResult>;

type Props = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  nextMonth: string;
  timezone: CalendarTimezone;
  events: CalendarEventView[];
  limit: number;
  truncated: boolean;
  schemaPending: boolean;
  view: CalendarDisplayView;
  selectedDate: string;
  today: string;
  actions: {
    create: CalendarAction;
    update: CalendarAction;
    remove: CalendarAction;
  };
};

const fieldClass =
  "min-h-11 min-w-0 w-full rounded-lg border " +
  "border-input bg-background px-3 py-2 " +
  "text-sm outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring disabled:opacity-50";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayLongNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clock12(instantIso: string, timezone: string): { time: string; meridiem: string } {
  const parts = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).formatToParts(new Date(instantIso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const meridiem = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toLowerCase();
  return { time: `${hour}:${minute}`, meridiem };
}

function timeRange(startsAt: string, endsAt: string, timezone: string): string {
  const start = clock12(startsAt, timezone);
  const end = clock12(endsAt, timezone);
  // Same half-day keeps one meridiem, Google-style: "7:30 – 10:30am".
  return start.meridiem === end.meridiem
    ? `${start.time} – ${end.time}${end.meridiem}`
    : `${start.time}${start.meridiem} – ${end.time}${end.meridiem}`;
}

function dayLabel(instantIso: string, timezone: string, style: "long" | "short" = "long"): string {
  // Assembled from parts so the day always precedes the month ("29 September").
  const parts = new Intl.DateTimeFormat("en", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone: timezone,
  }).formatToParts(new Date(instantIso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** One icon-led form row, matching the layout of a calendar quick editor. */
function Row({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon
        aria-hidden="true"
        className="mt-2.5 size-5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function repeatLabel(recurrenceRule: string): string | null {
  const rule = parseRecurrence(recurrenceRule);
  if (!rule) return null;
  if (rule.frequency === "daily") return "Daily";
  if (rule.frequency === "monthly") return "Monthly";
  if (!rule.weekdays.length) return "Weekly";
  return `Weekly on ${rule.weekdays.map((day) => weekdayLongNames[day]).join(", ")}`;
}

export function EventFields({
  item,
  timezone,
  defaults,
  occurrenceOnly,
}: {
  item: CalendarEventView | null;
  timezone: CalendarTimezone;
  defaults: { start: string; end: string };
  occurrenceOnly: boolean;
}) {
  const initialRule = parseRecurrence(item?.recurrenceRule ?? "");
  const [frequency, setFrequency] = useState(initialRule?.frequency ?? "none");
  const [termination, setTermination] = useState(initialRule?.until ? "until" : initialRule?.count ? "count" : "never");
  const [until, setUntil] = useState(initialRule?.until ?? "");
  const [count, setCount] = useState(String(initialRule?.count ?? 10));
  const [isAllDay, setIsAllDay] = useState(
    item?.isAllDay ?? false
  );

  const [selectedZone, setSelectedZone] =
    useState<CalendarTimezone>(
      item?.timezone ?? timezone
    );

  const initialStart = item
    ? formatCalendarLocal(
        item.startsAt,
        item.timezone
      )
    : defaults.start;

  const initialEnd = item
    ? formatCalendarLocal(
        item.endsAt,
        item.timezone
      )
    : defaults.end;

  const initialEndDay =
    item?.isAllDay
      ? previousAllDayDate(
          item.endsAt,
          item.timezone
        )
      : initialEnd.slice(0, 10);

  const [startLocal, setStartLocal] = useState(initialStart);
  const [endLocal, setEndLocal] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart.slice(0, 10));
  const [endDate, setEndDate] = useState(initialEndDay);
  const [weekdays, setWeekdays] = useState(initialRule?.weekdays ?? [new Date(`${initialStart.slice(0, 10)}T00:00:00Z`).getUTCDay()]);
  const [weekdaysTouched, setWeekdaysTouched] = useState(!!initialRule?.weekdays.length);
  const firstDay = isAllDay ? startDate : startLocal.split("T")[0];
  const [timedStartDay, startClock = "09:00"] = startLocal.split("T");
  const [timedEndDay, endClock = "10:00"] = endLocal.split("T");
  const startInstant = parseCalendarLocal(startLocal, selectedZone);
  const endInstant = parseCalendarLocal(endLocal, selectedZone);
  const minutes = startInstant && endInstant ? (endInstant.getTime() - startInstant.getTime()) / 60_000 : 0;
  const dayCount = isCalendarDay(startDate) && isCalendarDay(endDate || startDate)
    ? (Date.parse(`${endDate || startDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 + 1 : 0;
  const duration = isAllDay
    ? (dayCount > 0 ? `${dayCount} ${dayCount === 1 ? "day" : "days"}` : null)
    : minutes > 0 ? [Math.floor(minutes / 1440) ? `${Math.floor(minutes / 1440)}d` : "", Math.floor(minutes % 1440 / 60) ? `${Math.floor(minutes % 1440 / 60)}h` : "", minutes % 60 ? `${minutes % 60}m` : ""].filter(Boolean).join(" ") : null;
  const selectedWeekdays = !weekdaysTouched && frequency === "weekly"
    ? (isCalendarDay(firstDay) ? [new Date(`${firstDay}T00:00:00Z`).getUTCDay()] : [])
    : weekdays;

  function toggleAllDay(checked: boolean) {
    if (checked) {
      const first = timedStartDay;
      const last = endClock === "00:00" && isCalendarDay(timedEndDay) && endLocal > startLocal
        ? new Date(Date.parse(`${timedEndDay}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
        : timedEndDay;
      setStartDate(first);
      setEndDate(last < first ? first : last);
    } else {
      const nextStart = startDate ? `${startDate}T${startClock}` : "";
      const lastDay = endDate || startDate;
      const last = endClock === "00:00" && isCalendarDay(lastDay)
        ? new Date(Date.parse(`${lastDay}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
        : lastDay;
      let nextEnd = last ? `${last}T${endClock}` : "";
      const instant = parseCalendarLocal(nextStart, selectedZone);
      if (nextEnd <= nextStart && instant) nextEnd = formatCalendarLocal(new Date(instant.getTime() + 3_600_000), selectedZone);
      setStartLocal(nextStart);
      setEndLocal(nextEnd);
    }
    setIsAllDay(checked);
  }

  // Only series-level recurring events may omit an end date;
  // they then produce one-day instances.
  const recurringSeries = !occurrenceOnly && frequency !== "none";

  return (
    <div className="space-y-5">
      <input type="hidden" name="isAllDay" value={String(isAllDay)} />
      {/* TITLE */}
      <label className="block">
        <span className="sr-only">Event title</span>
        <input
          id="calendar-event-title"
          name="title"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={item?.title ?? ""}
          placeholder="Add title"
          className="w-full rounded-md bg-transparent px-2 py-2 text-xl font-semibold tracking-tight outline-none ring-inset placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {/* LINKED TASK NOTE — time blocks keep their association silently. */}
      {item?.taskId && (
        <>
          <input
            type="hidden"
            name="taskId"
            value={item.taskId}
          />
          <p className="ml-8 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Linked to a task and shown as a violet time block. The association is kept.
          </p>
        </>
      )}

      {/* WHEN */}
      <section aria-label="Event schedule">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-4 rounded-2xl border bg-muted/20 p-3 sm:p-4">
              <EventDateField id="calendar-start-day" label="Start date" name={isAllDay ? "startDate" : undefined}
                value={isAllDay ? startDate : timedStartDay}
                onChange={(day) => isAllDay ? setStartDate(day) : setStartLocal(`${day}T${startClock}`)} />
              {!isAllDay && <EventTimeField id="calendar-start-time" label="Start time" value={startClock}
                onChange={(time) => setStartLocal(`${timedStartDay}T${time}`)} />}
            </div>
            <div className="space-y-4 rounded-2xl border bg-muted/20 p-3 sm:p-4">
              <EventDateField id="calendar-end-day" label={isAllDay ? "End date (inclusive)" : "End date"} name={isAllDay ? "endDate" : undefined}
                value={isAllDay ? endDate : timedEndDay} min={firstDay}
                required={!isAllDay || !recurringSeries}
                onChange={(day) => isAllDay ? setEndDate(day) : setEndLocal(`${day}T${endClock}`)} />
              {!isAllDay && <EventTimeField id="calendar-end-time" label="End time" value={endClock}
                onChange={(time) => setEndLocal(`${timedEndDay}T${time}`)} />}
              {isAllDay && recurringSeries && <p className="text-xs leading-5 text-muted-foreground">Optional: leave empty for one-day occurrences.</p>}
            </div>
          </div>
          {!isAllDay && <><input type="hidden" name="startLocal" value={startLocal} /><input type="hidden" name="endLocal" value={endLocal} /></>}
          <p role="status" className={`flex items-center gap-2 text-xs ${duration ? "text-muted-foreground" : "text-destructive"}`}>
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />{duration ? `Duration: ${duration}` : "Choose an end date and time after the start."}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label
              htmlFor="calendar-event-all-day"
              className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"
            >
              <input
                id="calendar-event-all-day"
                type="checkbox"
                checked={isAllDay}
                onChange={(event) =>
                  toggleAllDay(event.target.checked)
                }
                className="size-4 accent-primary"
              />
              All day
            </label>

            <label
              htmlFor="calendar-event-timezone"
              className="sr-only"
            >
              Timezone
            </label>
            <select
              id="calendar-event-timezone"
              name="timezone"
              value={selectedZone}
              onChange={(event) =>
                setSelectedZone(
                  event.target.value as CalendarTimezone
                )
              }
              className="min-h-11 min-w-0 flex-1 basis-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-72 sm:basis-auto"
            >
              {CALENDAR_TIMEZONES.map(
                (zone) => (
                  <option
                    key={zone.value}
                    value={zone.value}
                  >
                    {zone.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* REPEAT */}
          {!occurrenceOnly && (
            <div className="space-y-2">
              <label
                htmlFor="calendar-recurrence"
                className="sr-only"
              >
                Repeat
              </label>
              <select
                id="calendar-recurrence"
                className={fieldClass}
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as typeof frequency)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>

              {frequency === "weekly" && (
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-muted-foreground">Repeat on</legend>
                  <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((index) => (
                    <label key={index} className="cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        aria-label={weekdayLongNames[index]}
                        checked={selectedWeekdays.includes(index)}
                        onChange={(event) => { setWeekdaysTouched(true); setWeekdays(event.target.checked ? [...selectedWeekdays, index] : selectedWeekdays.filter((day) => day !== index)); }}
                      />
                      <span className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-1 text-xs font-medium transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        {weekdayNames[index]}
                      </span>
                    </label>
                  ))}
                  </div>
                </fieldset>
              )}

              {frequency !== "none" && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="calendar-termination"
                      className="sr-only"
                    >
                      Repeat ends
                    </label>
                    <select
                      id="calendar-termination"
                      className={`${fieldClass} sm:max-w-48`}
                      value={termination}
                      onChange={(event) => setTermination(event.target.value)}
                    >
                      <option value="never">Never ends</option>
                      <option value="until">On date</option>
                      <option value="count">After occurrences</option>
                    </select>

                    {termination === "until" && <div className="w-full min-w-0 sm:max-w-60"><EventDateField id="calendar-repeat-until" label="Last occurrence date" value={until} min={firstDay} onChange={setUntil} /></div>}

                    {termination === "count" && (
                      <input
                        type="number"
                        required
                        min={1}
                        max={10000}
                        aria-label="Occurrence count"
                        className={`${fieldClass} sm:max-w-32`}
                        value={count}
                        onInput={(event) => setCount(event.currentTarget.value)}
                      />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Starts on {isCalendarDay(firstDay) ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${firstDay}T12:00:00Z`)) : "the selected date"}.
                    {frequency === "monthly" && " Monthly dates that do not exist are skipped."}
                  </p>
                </>
              )}
            </div>
          )}

          <input
            type="hidden"
            name="recurrenceRule"
            value={!occurrenceOnly && frequency !== "none" ? JSON.stringify({ frequency, weekdays: selectedWeekdays, ...(termination === "until" ? { until } : termination === "count" ? { count: Number(count) } : {}) }) : ""}
          />
        </div>
      </section>

      {/* LOCATION */}
      <Row icon={MapPin}>
        <label
          htmlFor="calendar-event-location"
          className="sr-only"
        >
          Location
        </label>
        <input
          id="calendar-event-location"
          name="location"
          type="text"
          maxLength={255}
          defaultValue={item?.location ?? ""}
          placeholder="Add location"
          className={fieldClass}
        />
      </Row>

      {/* DESCRIPTION */}
      <Row icon={AlignLeft}>
        <label
          htmlFor="calendar-event-description"
          className="sr-only"
        >
          Description
        </label>
        <textarea
          id="calendar-event-description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={item?.description ?? ""}
          placeholder="Add description"
          className={`${fieldClass} resize-y`}
        />
      </Row>
    </div>
  );
}

function eventSchedule(
  item: CalendarEventView
): string {
  const timezone = item.timezone;
  const startDay = formatCalendarLocal(item.startsAt, timezone).slice(0, 10);
  const endDay = item.isAllDay
    ? previousAllDayDate(item.endsAt, timezone)
    : formatCalendarLocal(item.endsAt, timezone).slice(0, 10);

  if (startDay === endDay) {
    const day = dayLabel(item.startsAt, timezone);
    return item.isAllDay
      ? `${day} ⋅ All day`
      : `${day} ⋅ ${timeRange(item.startsAt, item.endsAt, timezone)}`;
  }

  if (item.isAllDay) {
    const inclusiveEnd = new Date(`${endDay}T00:00:00Z`).toISOString();
    return `${dayLabel(item.startsAt, timezone, "short")} – ${dayLabel(inclusiveEnd, timezone, "short")} ⋅ All day`;
  }

  const start = clock12(item.startsAt, timezone);
  const end = clock12(item.endsAt, timezone);
  return `${dayLabel(item.startsAt, timezone, "short")} ⋅ ${start.time}${start.meridiem} – ${dayLabel(item.endsAt, timezone, "short")} ⋅ ${end.time}${end.meridiem}`;
}

const PREVIEW_KIND_LABEL: { [K in NonNullable<CalendarEventView["kind"]>]?: string } = {
  block: "Task time block",
  deadline: "Task deadline",
  planner: "Planned task",
  google: "Imported from Google Calendar",
};

export function EventManager({
  month,
  monthLabel,
  timezone,
  events,
  truncated,
  schemaPending,
  view,
  selectedDate,
  today,
  actions,
}: Props) {
  const router = useRouter();
  const editorFormId = useId();

  const [editor, setEditor] =
    useState<CalendarEventView | "create" | null>(
      null
    );

  const [preview, setPreview] = useState<CalendarEventView | null>(null);
  const [previewDelete, setPreviewDelete] = useState(false);
  const [monthEventsOpen, setMonthEventsOpen] = useState(false);
  const monthEventsTrigger = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Captured when "New event" is clicked so the dialog opens prefilled
  // with the current hour without reading the clock during render.
  const [createDefaults, setCreateDefaults] = useState({ start: "", end: "" });

  const [pending, startTransition] =
    useTransition();

  const [scope, setScope] = useState<"series" | "occurrence">("occurrence");
  const [conflictConfirmed, setConflictConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const editing =
    editor !== null && editor !== "create"
      ? editor
      : null;

  // The visual grid spans adjacent days; the manager list stays within the month.
  const monthEvents = eventsInMonth(events, month, timezone);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function openEditor(
    value: CalendarEventView | "create"
  ) {
    if (value !== "create" && value.kind && value.kind !== "event" && value.kind !== "block") return;
    editorTrigger.current = value === "create"
      ? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      : previewTrigger.current ?? monthEventsTrigger.current;
    setEditor(value);
    setScope(value !== "create" && value.recurrenceRule ? "occurrence" : "series");
    setConflictConfirmed(false);
    setError("");
    setFeedback("");
    setConfirmDelete(false);
  }

  function openCreate() {
    setCreateDefaults(eventDefaults(selectedDate, timezone, new Date()));
    openEditor("create");
  }

  function save(data: FormData) {
    if (!editor || pending) return;
    const invalid = eventFormError(data);
    if (invalid) { setError(invalid); return; }

    const isCreate = editor === "create";

    if (!isCreate) {
      data.set("eventId", editor.seriesId ?? editor.id);
      data.set("scope", scope);
      if (editor.originalStart) data.set("originalStart", editor.originalStart);
    }

    data.set("confirmConflict", String(conflictConfirmed));
    startTransition(async () => {
      try {
        const result = isCreate
          ? await actions.create(data)
          : await actions.update(data);

        if (!result.ok) {
          if (result.code === "conflict") {
            setConflictConfirmed(true);
            setError(result.message ?? "Schedule conflict. Save again to continue.");
            return;
          }
          setError(
            result.code === "not_found"
              ? "Event not found or access denied."
              : "Invalid event details. Check the dates and fields."
          );
          return;
        }

        setEditor(null);
        setFeedback(
          isCreate
            ? "Event created successfully."
            : "Event updated successfully."
        );

        router.refresh();
      } catch {
        setError(
          "Could not save the event. Please try again."
        );
      }
    });
  }

  function submitRemoval(data: FormData) {
    if (pending) return;

    startTransition(async () => {
      try {
        const result = await actions.remove(data);

        if (!result.ok) {
          setError(
            "Event not found or access denied."
          );
          return;
        }

        setEditor(null);
        setPreview(null);
        setFeedback(
          "Event deleted successfully."
        );

        router.refresh();
      } catch {
        setError(
          "Could not delete the event. Please try again."
        );
      }
    });
  }

  function remove() {
    if (!editing || pending) return;

    const data = new FormData();
    data.set("eventId", editing.seriesId ?? editing.id);
    data.set("scope", scope);
    if (editing.originalStart) data.set("originalStart", editing.originalStart);

    submitRemoval(data);
  }

  function removePreview() {
    if (!preview || pending) return;

    const data = new FormData();
    data.set("eventId", preview.seriesId ?? preview.id);
    data.set("scope", preview.originalStart ? "occurrence" : "series");
    if (preview.originalStart) data.set("originalStart", preview.originalStart);

    setPreviewDelete(false);
    submitRemoval(data);
  }

  const previewDeletable = preview !== null && (!preview.kind || preview.kind === "event" || preview.kind === "block");

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <CalendarDays className="size-7 text-primary" />
            Calendar
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Create and manage your personal events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <Button type="button" ref={monthEventsTrigger} variant="outline" className="min-h-11 gap-2 px-4" onClick={() => setMonthEventsOpen(true)}>
          <ListFilter className="size-4" />Events this month<span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">{monthEvents.length}{truncated ? "+" : ""}</span>
        </Button>
        <Button
          type="button"
          className="min-h-11 gap-2 px-4"
          onClick={openCreate}
          disabled={pending || schemaPending}
        >
          <Plus className="size-4" />
          New event
        </Button>
        </div>
      </header>

      {feedback && (
        <p
          role="status"
          className="rounded-lg border border-green-600/30 p-3 text-sm text-green-700 dark:text-green-300"
        >
          {feedback}
        </p>
      )}

      <CalendarViews
        view={view}
        selectedDate={selectedDate}
        today={today}
        timezone={timezone}
        events={events}
        truncated={truncated}
        onSelectEvent={(event) => { previewTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setError(""); setPreview(event); }}
      />

      <MonthEventsDialog key={month} open={monthEventsOpen} onOpenChange={setMonthEventsOpen}
        monthLabel={monthLabel} events={monthEvents} timezone={timezone} truncated={truncated} scheduleLabel={(event) => eventSchedule(event.isAllDay ? event : { ...event, timezone })} triggerRef={monthEventsTrigger}
        onSelect={(event) => { setMonthEventsOpen(false); setError(""); previewTrigger.current = monthEventsTrigger.current; setPreview(event); }} />

      {/* EVENT PREVIEW */}
      {preview && (
        <WorkspaceDialog
          open
          onOpenChange={(open) => { if (!open) setPreview(null); }}
          title={preview.title}
          description={preview.kind ? PREVIEW_KIND_LABEL[preview.kind] : undefined}
          returnFocusRef={previewTrigger}
        >
          <div className="space-y-5">
            <Row icon={Clock3}>
              <p className="text-sm font-medium">{eventSchedule(preview)}</p>
              {preview.recurrenceRule && (
                <p className="mt-1 text-sm text-muted-foreground">{repeatLabel(preview.recurrenceRule)}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{preview.timezone}</p>
            </Row>

            {preview.location && (
              <Row icon={MapPin}>
                <p className="text-sm [overflow-wrap:anywhere]">{preview.location}</p>
              </Row>
            )}

            {preview.description && (
              <Row icon={AlignLeft}>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{preview.description}</p>
              </Row>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {previewDeletable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending}
                  onClick={() => setPreviewDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {preview.href && (
                  <a
                    href={preview.href}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {preview.kind === "google" ? "Open in Google Calendar" : "Open in Asteria"}
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setPreview(null)}
                >
                  Close
                </Button>
                {previewDeletable && (
                  <Button
                    type="button"
                    disabled={pending || schemaPending}
                    onClick={() => {
                      const target = preview;
                      setPreview(null);
                      openEditor(target);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </WorkspaceDialog>
      )}

      <ConfirmDialog
        open={previewDelete}
        onOpenChange={setPreviewDelete}
        title="Delete this event?"
        description={preview ? `“${preview.title}” will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete event"
        pending={pending}
        onConfirm={removePreview}
      />

      {/* EVENT EDITOR */}
      {editor && (
        <WorkspaceDialog
          open={Boolean(editor)}
          onOpenChange={(open) => { if (!open && !pending) setEditor(null); }}
          title={editing ? "Edit event" : "New event"}
          description={editing ? "Update the event details, then save." : "Schedule a new event."}
          variant="sheet"
          size="wide"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending || schemaPending}
                  onClick={() =>
                    setConfirmDelete(true)
                  }
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}

              <div className="ml-auto flex flex-1 justify-end gap-2 sm:flex-none">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || schemaPending}
                  className="min-h-11 flex-1 sm:flex-none"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  form={editorFormId}
                  disabled={pending || schemaPending}
                  className="min-h-11 flex-1 rounded-xl px-6 sm:flex-none"
                >
                  {pending ? "Saving..." : conflictConfirmed ? "Save anyway" : "Save"}
                </Button>
              </div>
            </div>
          }
          returnFocusRef={editorTrigger}
        >
          <form
            id={editorFormId}
            aria-label="Event form"
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();

              save(
                new FormData(
                  event.currentTarget
                )
              );
            }}
            className="space-y-5"
            onChange={() => { setConflictConfirmed(false); setError(""); }}
            onInput={() => { setConflictConfirmed(false); setError(""); }}
          >
            <fieldset disabled={pending || schemaPending} className="space-y-5">
              {editing?.recurrenceRule && (
                <div>
                  <label
                    htmlFor="calendar-scope"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Apply changes to
                  </label>
                  <select
                    id="calendar-scope"
                    className={fieldClass}
                    value={scope}
                    onChange={(event) => { setScope(event.target.value as typeof scope); setConflictConfirmed(false); }}
                  >
                    <option value="occurrence">This occurrence</option>
                    <option value="series">Entire series</option>
                  </select>
                  {scope === "series" && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Saving the entire series resets all occurrence edits and cancellations. The original series start is used.
                    </p>
                  )}
                </div>
              )}

              <EventFields
                key={`${editing?.id ?? "create"}:${scope}`}
                item={editing && scope === "series" ? { ...editing, startsAt: editing.seriesStartsAt ?? editing.startsAt, endsAt: editing.seriesEndsAt ?? editing.endsAt } : editing}
                timezone={timezone}
                defaults={createDefaults}
                occurrenceOnly={scope === "occurrence" && !!editing?.recurrenceRule}
              />
            </fieldset>

            {error && (
              <p
                role="alert"
                ref={errorRef}
                tabIndex={-1}
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive outline-none"
              >
                {error}
              </p>
            )}


          </form>
        </WorkspaceDialog>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => { if (!pending) setConfirmDelete(open); }}
        title="Delete this event?"
        description={editing ? `“${editing.title}” will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete event"
        pending={pending}
        onConfirm={remove}
      />

    </div>
  );
}
