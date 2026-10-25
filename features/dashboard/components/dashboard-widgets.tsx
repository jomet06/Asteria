import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CalendarDays,
  Flag,
  ListChecks,
  ListTodo,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCalendarLocal, readCalendarTimezone } from "@/features/calendar/date-time";
import { GeneratePlanButton } from "@/features/hermes/components/generate-plan-button";
import type {
  DashboardEvent,
  DashboardOverview,
  DashboardTask,
} from "../data";

const KIND_DOT: Record<DashboardEvent["kind"], string> = {
  event: "bg-primary",
  block: "bg-violet-500",
  google: "bg-sky-500",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  URGENT: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

function clockTime(iso: string, timezone: string) {
  return formatCalendarLocal(iso, readCalendarTimezone(timezone)).slice(11, 16);
}

function dayLabel(iso: string | null, timezone: string) {
  if (!iso) return "No due date";
  return formatCalendarLocal(iso, readCalendarTimezone(timezone)).slice(0, 10);
}

function eventTime(event: DashboardEvent, timezone: string) {
  if (event.isAllDay) return "All day";
  return `${clockTime(event.startsAt, timezone)} – ${clockTime(event.endsAt, timezone)}`;
}

function TaskRow({ task, timezone }: { task: DashboardTask; timezone: string }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {task.projectName ? `${task.projectName} · ` : ""}
          {task.planned ? "Planned today" : dayLabel(task.dueAt, timezone)}
        </p>
      </div>
      {!task.done && task.priority in PRIORITY_VARIANT && (
        <Badge variant={PRIORITY_VARIANT[task.priority]} className="shrink-0 text-[10px]">
          {task.priority}
        </Badge>
      )}
    </li>
  );
}

export function ScheduleCard({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-sky-500/10">
          <CalendarDays className="size-5 text-sky-500" aria-hidden="true" />
        </div>
        <CardTitle>Today&apos;s Schedule</CardTitle>
        <CardDescription>{overview.todayLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        {overview.events.length ? (
          <ul className="space-y-3">
            {overview.events.map((event) => (
              <li key={event.id} className="flex items-center gap-3">
                <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[event.kind]}`} aria-hidden />
                <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {eventTime(event, overview.timezone)}
                </span>
                <span className="min-w-0 truncate text-sm font-medium">{event.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No events scheduled for today.</p>
            <Link href="/calendar" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Create one <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TodaysTasksCard({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <ListTodo className="size-5 text-emerald-500" aria-hidden="true" />
        </div>
        <CardTitle>Today&apos;s Tasks</CardTitle>
        <CardDescription>Due today or planned for today.</CardDescription>
      </CardHeader>
      <CardContent>
        {overview.todaysTasks.length ? (
          <ul className="space-y-3">
            {overview.todaysTasks.map((task) => (
              <TaskRow key={task.id} task={task} timezone={overview.timezone} />
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No tasks due or planned today.</p>
            <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Add a task <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
        <Link href="/tasks" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Open To-Do List <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function DailyPlanCard({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
          <ListChecks className="size-5 text-violet-500" aria-hidden="true" />
        </div>
        <CardTitle>Daily Plan</CardTitle>
        <CardDescription>
          Your plan for today. Generate it with Asteria bot or arrange it manually.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview.planTasks.length ? (
          <ol className="space-y-3">
            {overview.planTasks.map((task, index) => (
              <li key={task.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${task.done ? "text-muted-foreground line-through" : ""}`}>
                    {task.title}
                  </p>
                  {task.projectName && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.projectName}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing is planned for today yet.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/tasks/planner?date=${overview.today}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Plan your day <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <GeneratePlanButton date={overview.today} />
        </div>
      </CardContent>
    </Card>
  );
}

export function DeadlinesCard({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Flag className="size-5 text-amber-500" aria-hidden="true" />
        </div>
        <CardTitle>Upcoming Deadlines</CardTitle>
        <CardDescription>Open tasks due within the next 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {overview.upcomingDeadlines.length ? (
          <ul className="space-y-3">
            {overview.upcomingDeadlines.map((task) => (
              <TaskRow key={task.id} task={task} timezone={overview.timezone} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No deadlines in the next two weeks.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RemindersCard({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="h-full transition-all duration-300 hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/5">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-destructive/10">
          <AlarmClock className="size-5 text-destructive" aria-hidden="true" />
        </div>
        <CardTitle>Important Reminders</CardTitle>
        <CardDescription>Overdue tasks waiting to be rescheduled.</CardDescription>
      </CardHeader>
      <CardContent>
        {overview.reminders.length ? (
          <ul className="space-y-3">
            {overview.reminders.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-0.5 text-xs text-destructive">overdue since {dayLabel(task.dueAt, overview.timezone)}</p>
                </div>
                <Badge variant="destructive" className="shrink-0 text-[10px]">
                  {task.priority}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing overdue. You&apos;re on track!</p>
        )}
      </CardContent>
    </Card>
  );
}
