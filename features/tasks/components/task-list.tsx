
"use client";

import {
  Check,
  CircleDashed,
  CalendarDays,
  Flag,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  OnWorkspaceResult,
  WorkspaceActions,
  WorkspaceProject,
  WorkspaceTask,
} from "../workspace-types";

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

  const overdue =
    due && due < today && !closed;

  const dateLabel =
    due === today
      ? "Today"
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

  return (
    <li className="group min-w-0 border-b border-border/55 last:border-0">
      <div
        className="flex min-w-0 items-start gap-1 rounded-lg py-1 transition-colors hover:bg-muted/45 sm:gap-2"
        aria-busy={pending}
      >
        {/* COMPLETE TASK BUTTON */}
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
              "flex size-[19px] items-center justify-center rounded-full border-[1.5px] border-muted-foreground/50 transition-colors group-hover:border-foreground",
              closed &&
                "border-muted-foreground/30 bg-muted text-muted-foreground",
              !closed &&
                task.priority === "URGENT" &&
                "border-red-600 dark:border-red-400",
              !closed &&
                task.priority === "HIGH" &&
                "border-amber-600 dark:border-amber-400"
            )}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : closed ? (
              <Check className="size-3" />
            ) : null}
          </span>
        </button>

        {/* TASK DETAILS BUTTON */}
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
              "block text-sm leading-6 wrap-break-word sm:text-[15px]",
              closed &&
                "text-muted-foreground line-through decoration-muted-foreground/50"
            )}
          >
            {task.title}
          </span>

          {/* TASK METADATA */}
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
            {task.status === "IN_PROGRESS" && (
              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                <CircleDashed className="size-3" />
                In progress
              </span>
            )}

            {task.status === "CANCELLED" && (
              <span>Cancelled</span>
            )}

            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue &&
                    "text-red-700 dark:text-red-300"
                )}
              >
                <CalendarDays className="size-3" />

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
                  "inline-flex items-center gap-1",
                  task.priority === "URGENT"
                    ? "text-red-700 dark:text-red-300"
                    : "text-amber-700 dark:text-amber-300"
                )}
              >
                <Flag className="size-3" />

                {task.priority === "URGENT"
                  ? "Urgent"
                  : "High"}
              </span>
            )}

            {view === "all" && (
              <span className="max-w-full truncate">
                {project?.name ?? "Inbox"}
                {project?.isArchived
                  ? " · Archived"
                  : ""}
              </span>
            )}

            {totalSubtasks > 0 && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3" />
                {completedSubtasks}/{totalSubtasks} subtasks
              </span>
            )}
          </span>
        </button>
      </div>

      {/* MUTATION ERROR */}
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

export function TaskList({
  tasks,
  projects,
  label = "Tasks",
  ...props
}: TaskListProps) {
  return (
    <ul
      aria-label={label}
      className="min-w-0"
    >
      {tasks.map((task) => (
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
