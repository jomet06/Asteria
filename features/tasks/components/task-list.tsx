
"use client";

import { useSearchParams } from "next/navigation";

import {
  Check,
  CircleDashed,
  Clock3,
  Link2,
  Loader2,
  CalendarDays,
  Flag,
  Mountain,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  OnWorkspaceResult,
  WorkspaceActions,
  WorkspaceProject,
  WorkspaceTask,
} from "../workspace-types";

import {
  readTaskSort,
  sortWorkspaceTasks,
} from "../task-sorting";

import { useWorkspaceMutation } from "./use-workspace-mutation";

type TaskListProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  view: string;
  today: string;
  actions: WorkspaceActions;
  onResult: OnWorkspaceResult;

  onOpen: (
    task: WorkspaceTask,
    trigger: HTMLButtonElement
  ) => void;

  onCompleted: () => void;
  label?: string;
};

const chipClass =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

const PRIORITY_ACCENT: Partial<
  Record<WorkspaceTask["priority"], string>
> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
};

function nextDay(day: string): string {
  return new Date(
    Date.parse(`${day}T00:00:00Z`) + 86_400_000
  )
    .toISOString()
    .slice(0, 10);
}

function TaskRow({
  task,
  project,
  view,
  today,
  actions,
  onResult,
  onOpen,
  onCompleted,
}: Omit<TaskListProps, "tasks" | "projects"> & {
  task: WorkspaceTask;
  project?: WorkspaceProject;
}) {
  const { pending, error, run } =
    useWorkspaceMutation(onResult);

  const closed =
    task.status === "DONE" ||
    task.status === "CANCELLED";

  const due = task.dueAt?.slice(0, 10);
  const tomorrow = nextDay(today);

  const overdue =
    due && due < today && !closed;

  const dateLabel =
    due === today
      ? "Today"
      : due === tomorrow
        ? "Tomorrow"
        : due
          ? new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              ...(due.slice(0, 4) !==
              today.slice(0, 4)
                ? { year: "numeric" }
                : {}),
              timeZone: "UTC",
            }).format(
              new Date(`${due}T00:00:00Z`)
            )
          : "";

  const completedSubtasks =
    task.subtasks?.filter(
      (subtask) => subtask.isCompleted
    ).length ?? 0;

  const totalSubtasks =
    task.subtasks?.length ?? 0;

  const showProgress =
    !closed &&
    typeof task.progress === "number" &&
    task.progress > 0 &&
    task.progress < 100;

  function toggleTaskStatus() {
    const data = new FormData();

    data.set("view", view);
    data.set("taskId", task.id);

    data.set(
      "nextStatus",
      closed ? "TODO" : "DONE"
    );

    run(
      actions.toggleTaskStatus,
      data,
      onCompleted
    );
  }

  const accent = !closed
    ? PRIORITY_ACCENT[task.priority]
    : undefined;

  return (
    <li className="min-w-0">
      <div
        className="group relative flex min-w-0 items-start gap-1 overflow-hidden rounded-xl border border-border/60 bg-card/50 py-1 pl-2 pr-1 transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-sm sm:gap-2 sm:pl-3"
        aria-busy={pending}
      >
        {/* PRIORITY ACCENT BAR */}
        {accent && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-2 left-0 w-[3px] rounded-full",
              accent,
              pending && "opacity-50"
            )}
          />
        )}

        {/* COMPLETE / REOPEN */}
        <button
          type="button"
          disabled={pending}
          aria-label={`${
            closed ? "Reopen" : "Complete"
          } task: ${task.title}`}
          onClick={toggleTaskStatus}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span
            className={cn(
              "flex size-[19px] items-center justify-center rounded-full border-[1.5px] transition-all duration-200",
              closed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/50 group-hover:scale-110 group-hover:border-foreground",
              !closed &&
                task.priority === "URGENT" &&
                "border-red-600 dark:border-red-400",
              !closed &&
                task.priority === "HIGH" &&
                "border-amber-600 dark:border-amber-400"
            )}
          >
            {pending ? (
              <Loader2
                className="size-3 animate-spin"
                aria-hidden="true"
              />
            ) : closed ? (
              <Check
                className="size-3"
                aria-hidden="true"
              />
            ) : null}
          </span>
        </button>

        {/* OPEN TASK DETAIL */}
        <button
          type="button"
          onClick={(event) =>
            onOpen(task, event.currentTarget)
          }
          aria-label={`Open task: ${task.title}`}
          className="min-h-11 min-w-0 flex-1 rounded-lg py-2.5 pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "block text-sm leading-6 wrap-break-word transition-colors sm:text-[15px]",
              closed
                ? "text-muted-foreground line-through decoration-muted-foreground/50"
                : "font-medium"
            )}
          >
            {task.title}
          </span>

          {/* PROGRESS BAR */}
          {showProgress && (
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{
                    width: `${task.progress}%`,
                  }}
                />
              </span>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {task.progress}%
              </span>
            </span>
          )}

          {/* TASK METADATA CHIPS */}
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs leading-5 text-muted-foreground">
            {task.status === "IN_PROGRESS" && (
              <span className={cn(chipClass, "bg-blue-500/10 text-blue-700 dark:text-blue-300")}>
                <CircleDashed className="size-3" aria-hidden="true" />
                In progress
              </span>
            )}

            {task.status === "CANCELLED" && (
              <span className={cn(chipClass, "bg-muted text-muted-foreground")}>
                Cancelled
              </span>
            )}

            {due && (
              <span
                className={cn(
                  chipClass,
                  overdue
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : due === today
                      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <CalendarDays
                  className="size-3"
                  aria-hidden="true"
                />

                <time dateTime={due}>
                  {dateLabel}
                  {overdue ? " · overdue" : ""}
                </time>
              </span>
            )}

            {(task.priority === "HIGH" ||
              task.priority === "URGENT") && (
              <span
                className={cn(
                  chipClass,
                  task.priority === "URGENT"
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                )}
              >
                <Flag
                  className="size-3"
                  aria-hidden="true"
                />

                {task.priority === "URGENT"
                  ? "Urgent"
                  : "High"}
              </span>
            )}

            {!closed && task.difficulty === "HARD" && (
              <span className={cn(chipClass, "bg-muted text-muted-foreground")}>
                <Mountain className="size-3" aria-hidden="true" />
                Hard
              </span>
            )}

            {!closed &&
              typeof task.estimatedMinutes === "number" && (
                <span className={cn(chipClass, "bg-muted text-muted-foreground")}>
                  <Clock3 className="size-3" aria-hidden="true" />
                  {task.estimatedMinutes >= 60
                    ? `${Math.round(task.estimatedMinutes / 60)}h${
                        task.estimatedMinutes % 60
                          ? ` ${task.estimatedMinutes % 60}m`
                          : ""
                      }`
                    : `${task.estimatedMinutes}m`}
                </span>
              )}

            {!closed && task.dependsOnTitle && (
              <span className={cn(chipClass, "max-w-56 bg-muted text-muted-foreground")}>
                <Link2 className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">after: {task.dependsOnTitle}</span>
              </span>
            )}

            {view === "all" && (
              <span className={cn(chipClass, "max-w-full bg-muted/60 text-muted-foreground")}>
                <span className="truncate">
                  {project?.name ?? "Inbox"}

                  {project?.isArchived
                    ? " · Archived"
                    : ""}
                </span>
              </span>
            )}

            {totalSubtasks > 0 && (
              <span className={cn(chipClass, "bg-muted text-muted-foreground")}>
                <Check
                  className="size-3"
                  aria-hidden="true"
                />

                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ACTION ERROR */}
      {error && (
        <p
          role="alert"
          className="pb-3 pl-12 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </li>
  );
}

// ========================================
// TASK LIST WITH SORTING
// ========================================

export function TaskList({
  tasks,
  projects,
  label = "Tasks",
  ...props
}: TaskListProps) {
  const searchParams = useSearchParams();

  // Read the selected sorting option from URL.
  const sort = readTaskSort(
    searchParams?.get("sort")
  );

  // Sort a copy of the Task array.
  const sortedTasks = sortWorkspaceTasks(
    tasks,
    sort
  );

  return (
    <ul
      aria-label={label}
      className="min-w-0 space-y-2"
    >
      {sortedTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          project={projects.find(
            (project) =>
              project.id === task.projectId
          )}
          {...props}
        />
      ))}
    </ul>
  );
}
