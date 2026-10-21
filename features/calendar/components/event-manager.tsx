
"use client";

import {
  useState,
  useTransition,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { parseRecurrence } from "../recurrence";

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
  schemaPending: boolean;
  tasks: { id: string; title: string }[];
  tasksTruncated: boolean;
  actions: {
    create: CalendarAction;
    update: CalendarAction;
    remove: CalendarAction;
  };
};

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-lg border " +
  "border-input bg-background px-3 py-2 " +
  "text-sm outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring disabled:opacity-50";

function EventFields({
  item,
  timezone,
  month,
  tasks,
  occurrenceOnly,
}: {
  item: CalendarEventView | null;
  timezone: CalendarTimezone;
  month: string;
  tasks: { id: string; title: string }[];
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

  const today = formatCalendarLocal(
    new Date(),
    timezone
  ).slice(0, 10);

  const defaultDay =
    today.slice(0, 7) === month
      ? today
      : `${month}-01`;

  const initialStart = item
    ? formatCalendarLocal(
        item.startsAt,
        item.timezone
      )
    : `${defaultDay}T09:00`;

  const initialEnd = item
    ? formatCalendarLocal(
        item.endsAt,
        item.timezone
      )
    : `${defaultDay}T10:00`;

  const initialEndDay =
    item?.isAllDay
      ? previousAllDayDate(
          item.endsAt,
          item.timezone
        )
      : initialEnd.slice(0, 10);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Task time block (optional)
        <select name="taskId" className={fieldClass} defaultValue={item?.taskId ?? ""} disabled={occurrenceOnly}>
          <option value="">No task association</option>
          {item?.taskId && !tasks.some((task) => task.id === item.taskId) && <option value={item.taskId}>Current task</option>}
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
      </label>
      {occurrenceOnly && <input type="hidden" name="taskId" value={item?.taskId ?? ""} />}
      {!occurrenceOnly && <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Recurrence</legend>
        <label className="block text-sm">Repeat
          <select className={fieldClass} value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}>
            <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
        </label>
        {frequency === "weekly" && <div className="flex flex-wrap gap-3">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={weekdays.includes(index)} onChange={(event) => setWeekdays(event.target.checked ? [...weekdays, index] : weekdays.filter((day) => day !== index))} />{day}</label>)}</div>}
        {frequency !== "none" && <>
          <label className="block text-sm">Ends<select className={fieldClass} value={termination} onChange={(event) => setTermination(event.target.value)}><option value="never">Never</option><option value="until">On date</option><option value="count">After occurrences</option></select></label>
          {termination === "until" && <label className="block text-sm">Last date<input type="date" required className={fieldClass} value={until} onChange={(event) => setUntil(event.target.value)} /></label>}
          {termination === "count" && <label className="block text-sm">Occurrence count<input type="number" required min={1} max={10000} className={fieldClass} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>}
          <p className="text-xs text-muted-foreground">The start date is the first occurrence. Missing monthly dates are skipped. Conflict checks cover the first year.</p>
        </>}
      </fieldset>}
      <input type="hidden" name="recurrenceRule" value={!occurrenceOnly && frequency !== "none" ? JSON.stringify({ frequency, weekdays, ...(termination === "until" ? { until } : termination === "count" ? { count } : {}) }) : ""} />
      <div>
        <label
          htmlFor="calendar-event-title"
          className="text-sm font-medium"
        >
          Event title
        </label>

        <input
          id="calendar-event-title"
          name="title"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={item?.title ?? ""}
          placeholder="e.g. Team meeting"
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="calendar-event-all-day"
          type="checkbox"
          checked={isAllDay}
          onChange={(event) =>
            setIsAllDay(event.target.checked)
          }
          className="size-4 accent-primary"
        />

        <label
          htmlFor="calendar-event-all-day"
          className="text-sm font-medium"
        >
          All-day event
        </label>

        <input
          type="hidden"
          name="isAllDay"
          value={String(isAllDay)}
        />
      </div>

      <div>
        <label
          htmlFor="calendar-event-timezone"
          className="text-sm font-medium"
        >
          Event timezone
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
          className={fieldClass}
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

        <p className="mt-1 text-xs text-muted-foreground">
          Times entered below are interpreted
          in this timezone.
        </p>
      </div>

      {isAllDay ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="calendar-start-day"
              className="text-sm font-medium"
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
              className="text-sm font-medium"
            >
              End date (inclusive)
            </label>

            <input
              id="calendar-end-day"
              name="endDate"
              type="date"
              required
              defaultValue={initialEndDay}
              className={fieldClass}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="calendar-start-time"
              className="text-sm font-medium"
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
              className="text-sm font-medium"
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

      <div>
        <label
          htmlFor="calendar-event-location"
          className="text-sm font-medium"
        >
          Location (optional)
        </label>

        <input
          id="calendar-event-location"
          name="location"
          type="text"
          maxLength={255}
          defaultValue={item?.location ?? ""}
          placeholder="e.g. Office, online"
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor="calendar-event-description"
          className="text-sm font-medium"
        >
          Description (optional)
        </label>

        <textarea
          id="calendar-event-description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={item?.description ?? ""}
          placeholder="Additional details..."
          className={`${fieldClass} resize-y`}
        />
      </div>
    </div>
  );
}

function eventSchedule(
  item: CalendarEventView
): string {
  const start = formatCalendarLocal(
    item.startsAt,
    item.timezone
  );

  if (item.isAllDay) {
    const endDay = previousAllDayDate(
      item.endsAt,
      item.timezone
    );

    return start.slice(0, 10) === endDay
      ? `${endDay} · All day`
      : `${start.slice(0, 10)} → ${endDay} · All day`;
  }

  const end = formatCalendarLocal(
    item.endsAt,
    item.timezone
  );

  if (
    start.slice(0, 10) ===
    end.slice(0, 10)
  ) {
    return (
      `${start.slice(0, 10)} · ` +
      `${start.slice(11)}–${end.slice(11)}`
    );
  }

  return (
    `${start.replace("T", " ")} → ` +
    `${end.replace("T", " ")}`
  );
}

export function EventManager({
  month,
  monthLabel,
  previousMonth,
  nextMonth,
  timezone,
  events,
  limit,
  schemaPending,
  tasks,
  tasksTruncated,
  actions,
}: Props) {
  const router = useRouter();

  const [editor, setEditor] =
    useState<CalendarEventView | "create" | null>(
      null
    );

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

  function remove() {
    if (!editing || pending) return;

    const data = new FormData();
    data.set("eventId", editing.seriesId ?? editing.id);
    data.set("scope", scope);
    if (editing.originalStart) data.set("originalStart", editing.originalStart);

    startTransition(async () => {
      try {
        const result = await actions.remove(
          data
        );

        if (!result.ok) {
          setError(
            "Event not found or access denied."
          );
          return;
        }

        setEditor(null);
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
          onClick={() => openEditor("create")}
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

      {tasksTruncated && <p role="status" className="text-sm text-muted-foreground">The task selector shows the first 500 tasks.</p>}
      {/* EVENT EDITOR */}
      {editor && (
        <section
          aria-label={
            editing ? "Edit event" : "Create event"
          }
          className="space-y-5 rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editing
                ? "Edit event"
                : "Create new event"}
            </h2>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close event editor"
              disabled={pending || schemaPending}
              onClick={() => setEditor(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

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
            {editing?.recurrenceRule && <label className="block text-sm font-medium">Apply changes to
              <select className={fieldClass} value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setConflictConfirmed(false); }}><option value="occurrence">This occurrence</option><option value="series">Entire series</option></select>
              {scope === "series" && <span className="mt-2 block text-xs text-muted-foreground">Saving the entire series resets all occurrence edits and cancellations. The original series start is used.</span>}
            </label>}
            <EventFields
              key={`${editing?.id ?? "create"}:${scope}`}
              item={editing && scope === "series" ? { ...editing, startsAt: editing.seriesStartsAt ?? editing.startsAt, endsAt: editing.seriesEndsAt ?? editing.endsAt } : editing}
              timezone={timezone}
              month={month}
              tasks={tasks}
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
              <div>
                {editing && !confirmDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending || schemaPending}
                    onClick={() =>
                      setConfirmDelete(true)
                    }
                  >
                    <Trash2 className="size-4" />
                    Delete event
                  </Button>
                )}

                {editing && confirmDelete && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Delete this event permanently?
                    </p>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={pending || schemaPending}
                        onClick={remove}
                      >
                        Yes, delete
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || schemaPending}
                        onClick={() =>
                          setConfirmDelete(false)
                        }
                      >
                        Keep event
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || schemaPending}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={pending || schemaPending}
                >
                  {pending
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Create event"}
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* MONTH NAVIGATION */}
      <section
        aria-label="Select calendar month"
        className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
      >
        <Link
          href={`/calendar?month=${previousMonth}`}
          aria-label="Previous month"
          className="flex size-10 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>

        <div className="text-center">
          <h2 className="font-semibold">
            {monthLabel}
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Event list · {timezone}
          </p>
        </div>

        <Link
          href={`/calendar?month=${nextMonth}`}
          aria-label="Next month"
          className="flex size-10 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronRight className="size-5" />
        </Link>
      </section>

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
            {events.length}
            {events.length === limit
              ? "+"
              : ""}{" "}
            events
          </span>
        </div>

        {events.length === 0 ? (
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
            {events.map((item) => (
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

                  <p className="text-xs text-muted-foreground">
                    {item.timezone}
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

        {events.length === limit && (
          <p className="border-t p-4 text-xs text-muted-foreground">
            Showing the first {limit} events.
            Narrow the displayed date range to inspect other events.
          </p>
        )}
      </section>
    </div>
  );
}
