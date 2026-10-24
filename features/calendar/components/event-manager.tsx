
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
  MapPin,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/features/tasks/components/workspace-dialog";

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

function EventFields({
  item,
  timezone,
  month,
  occurrenceOnly,
}: {
  item: CalendarEventView | null;
  timezone: CalendarTimezone;
  month: string;
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
          className="w-full rounded-md bg-transparent px-1 py-2 text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
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
  timezone,
  events,
  limit,
  schemaPending,
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
                month={month}
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
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending || schemaPending}
                    onClick={() =>
                      setConfirmDelete(true)
                    }
                  >
                    <Trash2 className="size-4" />
                    Delete
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
            events · {monthLabel}
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
