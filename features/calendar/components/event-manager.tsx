
"use client";

import {
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
import { calendarMonthRange } from "../date-time";

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
  "min-h-10 w-full rounded-lg border " +
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
  const formatter = new Intl.DateTimeFormat(
    "en",
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: timezone }
      : { weekday: "short", day: "numeric", month: "short", timeZone: timezone }
  );
  return formatter.format(new Date(instantIso));
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

function EventFields({
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
  const [weekdays, setWeekdays] = useState(initialRule?.weekdays ?? [new Date().getUTCDay()]);
  const [until, setUntil] = useState(initialRule?.until ?? "");
  const [count, setCount] = useState(initialRule?.count ?? 10);
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

  // Only series-level recurring events may omit an end date;
  // they then produce one-day instances.
  const recurringSeries = !occurrenceOnly && frequency !== "none";

  return (
    <div className="space-y-5">
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
      <Row icon={Clock3}>
        <div className="space-y-3">
          {isAllDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="calendar-start-day"
                  className="sr-only"
                >
                  Start date
                </label>
                <input
                  id="calendar-start-day"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={
                    initialStart.slice(0, 10)
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor="calendar-end-day"
                  className="sr-only"
                >
                  End date (inclusive)
                </label>
                <input
                  id="calendar-end-day"
                  name="endDate"
                  type="date"
                  required={!recurringSeries}
                  defaultValue={initialEndDay}
                  className={fieldClass}
                />
                {recurringSeries && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional — empty means one-day instances.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="calendar-start-time"
                  className="sr-only"
                >
                  Starts
                </label>
                <input
                  id="calendar-start-time"
                  name="startLocal"
                  type="datetime-local"
                  required
                  step={60}
                  defaultValue={initialStart}
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor="calendar-end-time"
                  className="sr-only"
                >
                  Ends
                </label>
                <input
                  id="calendar-end-time"
                  name="endLocal"
                  type="datetime-local"
                  required
                  step={60}
                  defaultValue={initialEnd}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label
              htmlFor="calendar-event-all-day"
              className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium"
            >
              <input
                id="calendar-event-all-day"
                type="checkbox"
                checked={isAllDay}
                onChange={(event) =>
                  setIsAllDay(event.target.checked)
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
              className="min-h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-56"
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
                <div className="flex flex-wrap gap-1.5">
                  {weekdayNames.map((day, index) => (
                    <label key={day} className="cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={weekdays.includes(index)}
                        onChange={(event) => setWeekdays(event.target.checked ? [...weekdays, index] : weekdays.filter((day) => day !== index))}
                      />
                      <span className="inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        {day}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {frequency !== "none" && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="calendar-termination"
                      className="sr-only"
                    >
                      Ends
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

                    {termination === "until" && (
                      <input
                        type="date"
                        required
                        aria-label="Last occurrence date"
                        className={`${fieldClass} sm:max-w-44`}
                        value={until}
                        onChange={(event) => setUntil(event.target.value)}
                      />
                    )}

                    {termination === "count" && (
                      <input
                        type="number"
                        required
                        min={1}
                        max={10000}
                        aria-label="Occurrence count"
                        className={`${fieldClass} sm:max-w-32`}
                        value={count}
                        onChange={(event) => setCount(Number(event.target.value))}
                      />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Starts on {initialStart.slice(0, 10)} as the first occurrence.
                    Monthly dates that do not exist are skipped.
                  </p>
                </>
              )}
            </div>
          )}

          <input
            type="hidden"
            name="recurrenceRule"
            value={!occurrenceOnly && frequency !== "none" ? JSON.stringify({ frequency, weekdays, ...(termination === "until" ? { until } : termination === "count" ? { count } : {}) }) : ""}
          />
        </div>
      </Row>

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
      ? `${day}⋅All day`
      : `${day}⋅${timeRange(item.startsAt, item.endsAt, timezone)}`;
  }

  if (item.isAllDay) {
    const inclusiveEnd = new Date(`${endDay}T00:00:00Z`).toISOString();
    return `${dayLabel(item.startsAt, timezone, "short")} – ${dayLabel(inclusiveEnd, timezone, "short")}⋅All day`;
  }

  const start = clock12(item.startsAt, timezone);
  const end = clock12(item.endsAt, timezone);
  return `${dayLabel(item.startsAt, timezone, "short")}⋅${start.time}${start.meridiem} – ${dayLabel(item.endsAt, timezone, "short")}⋅${end.time}${end.meridiem}`;
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
  limit,
  truncated,
  schemaPending,
  view,
  selectedDate,
  today,
  actions,
}: Props) {
  const router = useRouter();

  const [editor, setEditor] =
    useState<CalendarEventView | "create" | null>(
      null
    );

  const [preview, setPreview] = useState<CalendarEventView | null>(null);
  const [previewDelete, setPreviewDelete] = useState(false);
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
  const { from, to } = calendarMonthRange(month, timezone);
  const monthEvents = events.filter((event) =>
    Date.parse(event.startsAt) < to.getTime() &&
    Date.parse(event.endsAt) > from.getTime()
  );

  function openEditor(
    value: CalendarEventView | "create"
  ) {
    setEditor(value);
    setScope(value !== "create" && value.recurrenceRule ? "occurrence" : "series");
    setConflictConfirmed(false);
    setError("");
    setFeedback("");
    setConfirmDelete(false);
  }

  function openCreate() {
    const hour = new Date(
      Math.floor(Date.now() / 3_600_000) * 3_600_000
    );
    setCreateDefaults({
      start: formatCalendarLocal(hour, timezone),
      end: formatCalendarLocal(new Date(hour.getTime() + 3_600_000), timezone),
    });
    openEditor("create");
  }

  function save(data: FormData) {
    if (!editor || pending) return;

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

  const previewDeletable = preview !== null && (preview.kind === "event" || preview.kind === "block");

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

        <Button
          type="button"
          onClick={openCreate}
          disabled={pending || schemaPending}
        >
          <Plus className="size-4" />
          New event
        </Button>
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
        onSelectEvent={setPreview}
      />

      {/* EVENT PREVIEW */}
      {preview && (
        <WorkspaceDialog
          open
          onOpenChange={(open) => { if (!open) setPreview(null); }}
          title={preview.title}
          description={preview.kind ? PREVIEW_KIND_LABEL[preview.kind] : undefined}
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
                <p className="text-sm">{preview.location}</p>
              </Row>
            )}

            {preview.description && (
              <Row icon={AlignLeft}>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview.description}</p>
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
        >
          <form
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
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
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

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || schemaPending}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={pending || schemaPending}
                  className="rounded-full px-6"
                >
                  {pending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
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

      {/* EVENT LIST */}
      <section
        aria-label="Calendar events"
        className="rounded-xl border bg-card"
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <h2 className="font-semibold">
            Events this month
          </h2>

          <span className="text-xs text-muted-foreground">
            {monthEvents.length}
            {monthEvents.length === limit
              ? "+"
              : ""}{" "}
            events · {monthLabel}
          </span>
        </div>

        {monthEvents.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="mx-auto size-9 text-muted-foreground" />

            <h3 className="mt-3 font-medium">
              No events this month
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Create an event to get started.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {monthEvents.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="font-medium wrap-break-word">
                    {item.title}
                  </h3>

                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {eventSchedule(item)}
                  </p>

                  {item.location && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {item.location}
                    </p>
                  )}

                  {item.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    pending || schemaPending
                  }
                  onClick={() =>
                    openEditor(item)
                  }
                  aria-label={`Edit event: ${item.title}`}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}

        {monthEvents.length === limit && (
          <p className="border-t p-4 text-xs text-muted-foreground">
            Showing the first {limit} events.
            Narrow the displayed date range to inspect other events.
          </p>
        )}
      </section>
    </div>
  );
}
