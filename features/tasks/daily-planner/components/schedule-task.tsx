
"use client";

import Link from "next/link";
import {
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  CalendarPlus,
  Loader2,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlannerActionResult } from "../actions";

type Props = {
  taskId: string;
  today: string;
  addTaskToDay: (
    formData: FormData
  ) => Promise<PlannerActionResult>;
};

const errors: Record<string, string> = {
  invalid_input: "Choose a valid date.",
  task_not_found: "This task is no longer available.",
  already_planned:
    "This task is already planned for that date.",
  plan_not_found: "The plan item was not found.",
};

export function ScheduleTask({
  taskId,
  today,
  addTaskToDay,
}: Props) {
  const inputId = useId();

  const [plannedDate, setPlannedDate] =
    useState(today);

  const [message, setMessage] =
    useState<{
      kind: "success" | "error";
      text: string;
    } | null>(null);

  const [pending, startTransition] =
    useTransition();

  const locked = useRef(false);

  function schedule() {
    if (
      locked.current ||
      pending ||
      !plannedDate
    ) {
      return;
    }

    locked.current = true;
    setMessage(null);

    const data = new FormData();

    data.set("taskId", taskId);
    data.set("plannedDate", plannedDate);

    startTransition(async () => {
      try {
        const result = await addTaskToDay(data);

        if (!result.ok) {
          setMessage({
            kind: "error",
            text:
              errors[result.code] ??
              "Could not schedule this task.",
          });

          return;
        }

        setMessage({
          kind: "success",
          text: "Task added to your daily plan.",
        });
      } catch {
        setMessage({
          kind: "error",
          text:
            "Could not schedule this task. Please try again.",
        });
      } finally {
        locked.current = false;
      }
    });
  }

  return (
    <section
      aria-label="Schedule task"
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
      onKeyDown={(event) => {
        // Do not trigger the parent Task Save
        // keyboard shortcut from this section.
        if (event.key === "Enter") {
          event.stopPropagation();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <CalendarPlus
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />

        <h3 className="text-sm font-semibold">
          Schedule Task
        </h3>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        Choose when you want to work on this task.
        This does not change its deadline.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label
            htmlFor={inputId}
            className="text-xs font-medium"
          >
            Planning date
          </label>

          <input
            id={inputId}
            type="date"
            value={plannedDate}
            disabled={pending}
            onChange={(event) => {
              setPlannedDate(event.target.value);
              setMessage(null);
            }}
            className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
          />
        </div>

        <Button
          type="button"
          className="min-h-11"
          disabled={pending || !plannedDate}
          onClick={schedule}
        >
          {pending ? (
            <Loader2
              className="size-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <CalendarPlus
              className="size-4"
              aria-hidden="true"
            />
          )}

          {pending ? "Scheduling..." : "Schedule"}
        </Button>
      </div>

      {message && (
        <p
          role={
            message.kind === "error"
              ? "alert"
              : "status"
          }
          className={
            message.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-foreground"
          }
        >
          {message.text}
        </p>
      )}

      {plannedDate && (
        <Link
          href={`/tasks/planner?date=${encodeURIComponent(plannedDate)}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Open plan for this date
          <ArrowUpRight className="size-4" />
        </Link>
      )}
    </section>
  );
}
