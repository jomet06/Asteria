
"use client";

import { useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  WorkspaceTask,
} from "../workspace-types";

import { readTaskSort } from "../task-sorting";

// ========================================
// FILTER TYPES
// ========================================

export type TaskFilters = {
  query: string;
  status: "ALL" | WorkspaceTask["status"];
  priority: "ALL" | WorkspaceTask["priority"];
  due:
    | "ANY"
    | "OVERDUE"
    | "TODAY"
    | "UPCOMING"
    | "NO_DATE";
};

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  due: "ANY",
};

export function hasTaskFilters(
  filters: TaskFilters
): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.priority !== "ALL" ||
    filters.due !== "ANY"
  );
}

// ========================================
// FILTER LOGIC
// ========================================

export function matchesTaskFilters(
  task: WorkspaceTask,
  filters: TaskFilters,
  today: string
): boolean {
  const query = filters.query.trim().toLowerCase();

  if (query) {
    const searchableText =
      `${task.title} ${task.description ?? ""}`.toLowerCase();

    if (!searchableText.includes(query)) {
      return false;
    }
  }

  if (
    filters.status !== "ALL" &&
    task.status !== filters.status
  ) {
    return false;
  }

  if (
    filters.priority !== "ALL" &&
    task.priority !== filters.priority
  ) {
    return false;
  }

  const dueDate =
    task.dueAt?.slice(0, 10) ?? null;

  const isClosed =
    task.status === "DONE" ||
    task.status === "CANCELLED";

  switch (filters.due) {
    case "OVERDUE":
      return (
        dueDate !== null &&
        dueDate < today &&
        !isClosed
      );

    case "TODAY":
      return dueDate === today;

    case "UPCOMING":
      return (
        dueDate !== null &&
        dueDate > today
      );

    case "NO_DATE":
      return dueDate === null;

    default:
      return true;
  }
}

// ========================================
// COMPONENT TYPES
// ========================================

type Props = {
  value: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  onClear: () => void;
  matchingCount: number;
  totalCount: number;
};

const controlClass =
  "min-h-11 w-full rounded-lg border border-input " +
  "bg-background px-3 text-sm outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

// ========================================
// COMPONENT
// ========================================

export function TaskFilterBar({
  value,
  onChange,
  onClear,
  matchingCount,
  totalCount,
}: Props) {
  const searchParams = useSearchParams();

  const active = hasTaskFilters(value);

  const sort = readTaskSort(
    searchParams?.get("sort")
  );

  function update(
    patch: Partial<TaskFilters>
  ) {
    onChange({
      ...value,
      ...patch,
    });
  }

  // Store the selected sort in the URL.
  // Next.js synchronizes native history changes
  // with useSearchParams().
  function updateSort(rawValue: string) {
    const nextSort = readTaskSort(rawValue);

    const params = new URLSearchParams(
      window.location.search
    );

    if (nextSort === "DEFAULT") {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }

    const query = params.toString();

    const href =
      window.location.pathname +
      (query ? `?${query}` : "") +
      window.location.hash;

    window.history.replaceState(
      null,
      "",
      href
    );
  }

  return (
    <section
      aria-label="Filter and sort tasks"
      className="mb-7 space-y-4 rounded-xl border bg-card p-4"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal
            className="size-4"
            aria-hidden="true"
          />
          Filter & Sort
        </h2>

        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
          >
            <X className="size-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* SEARCH */}
      <div className="relative">
        <label
          htmlFor="task-search"
          className="sr-only"
        >
          Search tasks
        </label>

        <Search
          className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="task-search"
          type="search"
          autoComplete="off"
          maxLength={120}
          value={value.query}
          onChange={(event) =>
            update({
              query: event.target.value,
            })
          }
          placeholder="Search title or description..."
          className={`${controlClass} pl-10`}
        />
      </div>

      {/* FILTER CONTROLS */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* STATUS */}
        <div className="space-y-1.5">
          <label
            htmlFor="task-status-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Status
          </label>

          <select
            id="task-status-filter"
            value={value.status}
            onChange={(event) =>
              update({
                status:
                  event.target.value as TaskFilters["status"],
              })
            }
            className={controlClass}
          >
            <option value="ALL">
              All statuses
            </option>

            <option value="TODO">
              To do
            </option>

            <option value="IN_PROGRESS">
              In progress
            </option>

            <option value="DONE">
              Completed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        {/* PRIORITY */}
        <div className="space-y-1.5">
          <label
            htmlFor="task-priority-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Priority
          </label>

          <select
            id="task-priority-filter"
            value={value.priority}
            onChange={(event) =>
              update({
                priority:
                  event.target.value as TaskFilters["priority"],
              })
            }
            className={controlClass}
          >
            <option value="ALL">
              All priorities
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="URGENT">
              Urgent
            </option>
          </select>
        </div>

        {/* DUE DATE */}
        <div className="space-y-1.5">
          <label
            htmlFor="task-due-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Due date
          </label>

          <select
            id="task-due-filter"
            value={value.due}
            onChange={(event) =>
              update({
                due:
                  event.target.value as TaskFilters["due"],
              })
            }
            className={controlClass}
          >
            <option value="ANY">
              Any date
            </option>

            <option value="OVERDUE">
              Overdue
            </option>

            <option value="TODAY">
              Due today
            </option>

            <option value="UPCOMING">
              Upcoming
            </option>

            <option value="NO_DATE">
              No due date
            </option>
          </select>
        </div>

        {/* SORT */}
        <div className="space-y-1.5">
          <label
            htmlFor="task-sort"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <ArrowDownUp
              className="size-3"
              aria-hidden="true"
            />
            Sort by
          </label>

          <select
            id="task-sort"
            value={sort}
            onChange={(event) =>
              updateSort(event.target.value)
            }
            className={controlClass}
          >
            <option value="DEFAULT">
              Newest first
            </option>

            <option value="PRIORITY">
              Priority (highest first)
            </option>

            <option value="DUE_SOON">
              Due date (earliest first)
            </option>

            <option value="TITLE_AZ">
              Title (A–Z)
            </option>
          </select>
        </div>
      </div>

      {/* RESULT COUNT */}
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        Showing {matchingCount} of {totalCount} tasks
        {active ? " · Filters active" : ""}

        {sort !== "DEFAULT"
          ? " · Custom sorting"
          : ""}
      </p>
    </section>
  );
}
