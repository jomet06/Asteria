
"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type { PlannerActionResult } from "../actions";

// ========================================
// TYPES
// ========================================

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED";

type TaskPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

type PlannedItem = {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  projectName: string | null;
};

type TaskOption = {
  id: string;
  title: string;
  priority: TaskPriority;
  projectName: string | null;
};

type PlannerAction = (
  data: FormData
) => Promise<PlannerActionResult>;

type PlannerActions = {
  addTaskToDay: PlannerAction;
  removeTaskFromDay: PlannerAction;
  moveTaskToDay: PlannerAction;
};

type Props = {
  date: string;
  today: string;
  items: PlannedItem[];
  tasks: TaskOption[];
  actions: PlannerActions;
};

type Notice = {
  kind: "success" | "error";
  text: string;
};

// ========================================
// DATE HELPERS
// ========================================

function shiftDate(
  date: string,
  days: number
): string {
  const value = new Date(
    `${date}T12:00:00.000Z`
  );

  value.setUTCDate(
    value.getUTCDate() + days
  );

  return value.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${date}T12:00:00.000Z`)
  );
}

function plannerUrl(date: string) {
  return `/tasks/planner?date=${date}`;
}

// ========================================
// FEEDBACK
// ========================================

const errorMessages: Record<string, string> = {
  invalid_input:
    "Please check your input and try again.",
  task_not_found:
    "This task is no longer available.",
  plan_not_found:
    "This planned item is no longer available.",
  already_planned:
    "This task is already planned for that date.",
};

// ========================================
// PLANNED TASK ROW
// ========================================

function PlannedTaskRow({
  item,
  date,
  pending,
  onRemove,
  onMove,
}: {
  item: PlannedItem;
  date: string;
  pending: boolean;
  onRemove: (id: string) => void;
  onMove: (
    id: string,
    targetDate: string
  ) => void;
}) {
  const [targetDate, setTargetDate] =
    useState(date);

  const completed = item.status === "DONE";

  const statusLabel: Record<TaskStatus, string> = {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    DONE: "Completed",
    CANCELLED: "Cancelled",
  };

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {completed ? (
            <CheckCircle2
              className="size-5 text-green-600"
              aria-label="Completed"
            />
          ) : (
            <Clock3
              className="size-5 text-muted-foreground"
              aria-label="Not completed"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <h3
            className={
              completed
                ? "break-words font-medium text-muted-foreground line-through"
                : "break-words font-medium"
            }
          >
            {item.title}
          </h3>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{statusLabel[item.status]}</span>

            <span aria-hidden="true">·</span>

            <span>
              {item.projectName ?? "Inbox"}
            </span>

            {item.priority === "HIGH" ||
            item.priority === "URGENT" ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {item.priority === "URGENT"
                    ? "Urgent"
                    : "High priority"}
                </span>
              </>
            ) : null}

            {item.dueAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Due {item.dueAt.slice(0, 10)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label
            htmlFor={`move-${item.id}`}
            className="text-xs text-muted-foreground"
          >
            Move to date
          </label>

          <input
            id={`move-${item.id}`}
            type="date"
            value={targetDate}
            disabled={pending}
            onChange={(event) =>
              setTargetDate(event.target.value)
            }
            className="block min-h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          disabled={
            pending ||
            !targetDate ||
            targetDate === date
          }
          onClick={() =>
            onMove(item.id, targetDate)
          }
        >
          Move
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.title} from this day`}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    </li>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function DailyPlanner({
  date,
  today,
  items,
  tasks,
  actions,
}: Props) {
  const router = useRouter();

  const [selectedTaskId, setSelectedTaskId] =
    useState("");

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [pending, startTransition] =
    useTransition();

  const locked = useRef(false);

  const completedCount = items.filter(
    (item) => item.status === "DONE"
  ).length;

  const total = items.length;

  const progress =
    total === 0
      ? 0
      : Math.round(
          (completedCount / total) * 100
        );

  // Don't show Tasks already planned on this date.
  const plannedTaskIds = new Set(
    items.map((item) => item.taskId)
  );

  const availableTasks = tasks.filter(
    (task) => !plannedTaskIds.has(task.id)
  );

  const validSelectedTaskId =
    availableTasks.some(
      (task) => task.id === selectedTaskId
    )
      ? selectedTaskId
      : "";

  // Shared mutation handler.
  function runAction(
    action: PlannerAction,
    data: FormData,
    successMessage: string,
    onSuccess?: () => void
  ) {
    if (locked.current) return;

    locked.current = true;
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await action(data);

        if (!result.ok) {
          setNotice({
            kind: "error",
            text:
              errorMessages[result.code] ??
              "Something went wrong.",
          });

          return;
        }

        setNotice({
          kind: "success",
          text: successMessage,
        });

        onSuccess?.();

        // Fetch the updated Server Component data.
        router.refresh();
      } catch {
        setNotice({
          kind: "error",
          text:
            "Could not save your changes. Please try again.",
        });
      } finally {
        locked.current = false;
      }
    });
  }

  function addTask() {
    if (!validSelectedTaskId) return;

    const data = new FormData();

    data.set("taskId", validSelectedTaskId);
    data.set("plannedDate", date);

    runAction(
      actions.addTaskToDay,
      data,
      "Task added to your daily plan.",
      () => setSelectedTaskId("")
    );
  }

  function removeTask(id: string) {
    const data = new FormData();

    data.set("planItemId", id);

    runAction(
      actions.removeTaskFromDay,
      data,
      "Task removed from this day. The original task is still in your To-Do List."
    );
  }

  function moveTask(
    id: string,
    targetDate: string
  ) {
    const data = new FormData();

    data.set("planItemId", id);
    data.set("plannedDate", targetDate);

    runAction(
      actions.moveTaskToDay,
      data,
      "Task moved to the selected date."
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 pb-20 sm:px-8 sm:py-12">
      {/* Back navigation */}
      <Link
        href="/tasks"
        className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" />
        Back to To-Do List
      </Link>

      {/* Page heading */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          Daily Planner
        </div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {date === today
            ? "Plan your today"
            : "Your daily plan"}
        </h1>

        <p className="text-sm leading-6 text-muted-foreground">
          Focus on what matters, one day at a time.
        </p>
      </header>

      {/* Date navigation */}
      <section
        aria-label="Choose planning date"
        className="rounded-xl border bg-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">
              {formatDate(date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {date === today
                ? "Today"
                : "Selected planning date"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={plannerUrl(shiftDate(date, -1))}
              aria-label="Previous day"
              className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="size-4" />
            </Link>

            <Link
              href={plannerUrl(today)}
              className="flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              Today
            </Link>

            <Link
              href={plannerUrl(shiftDate(date, 1))}
              aria-label="Next day"
              className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t pt-4">
          <label
            htmlFor="planner-date"
            className="text-xs font-medium text-muted-foreground"
          >
            Jump to a date
          </label>

          <input
            id="planner-date"
            type="date"
            value={date}
            onChange={(event) => {
              const value = event.target.value;

              if (value) {
                router.push(plannerUrl(value));
              }
            }}
            className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm sm:max-w-xs"
          />
        </div>
      </section>

      {/* Progress */}
      <section
        aria-label="Daily progress"
        className="space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">
            Daily progress
          </h2>

          <span className="text-sm text-muted-foreground">
            {completedCount}/{total} completed
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Daily completion progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {/* Add existing Task */}
      <section
        aria-labelledby="add-task-heading"
        className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
      >
        <div className="space-y-1">
          <h2
            id="add-task-heading"
            className="font-semibold"
          >
            Add a task to this day
          </h2>

          <p className="text-sm text-muted-foreground">
            Choose an existing task from your To-Do List.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="task-picker"
              className="sr-only"
            >
              Choose task
            </label>

            <select
              id="task-picker"
              value={validSelectedTaskId}
              disabled={
                pending ||
                availableTasks.length === 0
              }
              onChange={(event) =>
                setSelectedTaskId(event.target.value)
              }
              className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">
                Select a task...
              </option>

              {availableTasks.map((task) => (
                <option
                  key={task.id}
                  value={task.id}
                >
                  {task.title}
                  {task.projectName
                    ? ` — ${task.projectName}`
                    : " — Inbox"}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            onClick={addTask}
            disabled={
              pending ||
              !validSelectedTaskId
            }
            className="min-h-11"
          >
            <Plus className="size-4" />
            {pending ? "Saving..." : "Add to Planner"}
          </Button>
        </div>

        {availableTasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No available unfinished tasks to add.
            Create another task in your To-Do List
            or choose a different day.
          </p>
        )}
      </section>

      {/* Feedback */}
      {notice && (
        <div
          role={
            notice.kind === "error"
              ? "alert"
              : "status"
          }
          className={
            notice.kind === "error"
              ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              : "rounded-lg border bg-muted/50 p-4 text-sm"
          }
        >
          {notice.text}
        </div>
      )}

      {/* Planned Tasks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Planned tasks
          </h2>

          <span className="text-sm text-muted-foreground">
            {items.length} tasks
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-14 text-center">
            <CalendarDays className="mx-auto size-10 text-muted-foreground" />

            <h3 className="mt-4 font-semibold">
              Nothing planned yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Choose a task above to start planning
              your day.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <PlannedTaskRow
                key={item.id}
                item={item}
                date={date}
                pending={pending}
                onRemove={removeTask}
                onMove={moveTask}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
