
import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";
import { getMyAccount } from "@/features/profile/data";
import { getMyTaskWorkspace } from "@/features/tasks/data";

import { getMyDailyPlan } from "@/features/tasks/daily-planner/data";
import { parsePlannerDate } from "@/features/tasks/daily-planner/date";

import {
  addTaskToDay,
  removeTaskFromDay,
  moveTaskToDay,
} from "@/features/tasks/daily-planner/actions";

import { DailyPlanner } from "@/features/tasks/daily-planner/components/daily-planner";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    date?: string | string[];
  }>;
};

// Get today's date in the user's profile timezone.
function getToday(timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  };

  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat(
      "en-US",
      options
    );
  } catch {
    formatter = new Intl.DateTimeFormat(
      "en-US",
      {
        ...options,
        timeZone: "Asia/Jakarta",
      }
    );
  }

  const parts = formatter.formatToParts(new Date());

  const year = parts.find(
    (item) => item.type === "year"
  )?.value;

  const month = parts.find(
    (item) => item.type === "month"
  )?.value;

  const day = parts.find(
    (item) => item.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

export default async function PlannerPage({
  searchParams,
}: PageProps) {
  await connection();

  const params = await searchParams;

  const { profile } = await getMyAccount();

  const today = getToday(profile.timezone);

  // Accept only one valid date parameter.
  const requestedDate =
    typeof params.date === "string"
      ? params.date
      : null;

  const selectedDate =
    requestedDate &&
    parsePlannerDate(requestedDate)
      ? requestedDate
      : today;

  // Load the plan and the user's existing Tasks.
  const [plan, workspace] = await Promise.all([
    getMyDailyPlan(selectedDate),
    getMyTaskWorkspace(),
  ]);

  const projectNames = new Map(
    workspace.projects.map((project) => [
      project.id,
      project.name,
    ])
  );

  const tasks = workspace.tasks
    .filter(
      (task) =>
        task.status !== "DONE" &&
        task.status !== "CANCELLED"
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      projectName: task.projectId
        ? (projectNames.get(task.projectId) ?? null)
        : null,
    }));

  const items = (plan?.items ?? []).map(
    (item) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.task.title,
      status: item.task.status,
      priority: item.task.priority,
      dueAt:
        item.task.dueAt?.toISOString() ?? null,
      projectName:
        item.task.project?.name ?? null,
    })
  );

  return (
    <AppShell activePage="tasks" workspace>
      <DailyPlanner
        date={selectedDate}
        today={today}
        items={items}
        tasks={tasks}
        actions={{
          addTaskToDay,
          removeTaskFromDay,
          moveTaskToDay,
        }}
      />
    </AppShell>
  );
}
