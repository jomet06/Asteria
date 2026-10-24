
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ListTodo,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMyAccount } from "@/features/profile/data";
import { getMyDashboardOverview } from "@/features/dashboard/data";
import {
  DailyPlanCard,
  DeadlinesCard,
  NowNextCard,
  RemindersCard,
  ScheduleCard,
  TodaysTasksCard,
} from "@/features/dashboard/components/dashboard-widgets";

export const instant = false;

const modules = [
  {
    id: "calendar",
    title: "Calendar",
    description:
      "Manage events, meetings, and upcoming schedules.",
    icon: CalendarDays,
  },
  {
    id: "tasks",
    title: "To-Do List",
    description:
      "Manage tasks, projects, priorities, and deadlines.",
    icon: ListTodo,
  },
  {
    id: "hermes",
    title: "Hermes AI",
    description:
      "Your future AI assistant for life management.",
    icon: Bot,
  },
];

export default async function DashboardPage() {
  const { user, profile } = await getMyAccount();
  const overview = await getMyDashboardOverview();

  const displayName =
    profile.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <AppShell activePage="dashboard">
      <div className="mb-10">
        <Badge variant="secondary">
          Personal Workspace
        </Badge>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back, {displayName}!
        </h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Here is what today looks like across your
          schedule, tasks, and plans.
        </p>
      </div>

      <section aria-labelledby="today-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="today-title"
              className="text-xl font-semibold"
            >
              Today
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {overview.todayLabel} · {overview.timezone}
            </p>
          </div>

          {overview.truncated && (
            <Badge variant="outline">
              Showing the first items of the day
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NowNextCard overview={overview} />
          <ScheduleCard overview={overview} />
          <TodaysTasksCard overview={overview} />
          <DailyPlanCard overview={overview} />
          <DeadlinesCard overview={overview} />
          <RemindersCard overview={overview} />
        </div>
      </section>

      <section aria-labelledby="modules-title" className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="modules-title"
              className="text-xl font-semibold"
            >
              Your Workspace
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Core modules planned for Asteria.
            </p>
          </div>

          <Badge variant="outline">
            In Development
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.id} className="h-full">
                <CardHeader>
                  <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5" />
                  </div>

                  <CardTitle>
                    {module.title}
                  </CardTitle>

                  <CardDescription>
                    {module.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {module.id === "tasks" ? (
                    <Link href="/tasks" className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      Open To-Do List <ArrowRight className="size-4" />
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">Coming Soon</span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Profile &amp; Preferences
            </CardTitle>

            <CardDescription>
              Keep your personal information and
              timezone up to date.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm">
              <span className="text-muted-foreground">
                Email:{" "}
              </span>
              {user.email}
            </p>

            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">
                Timezone:{" "}
              </span>
              {profile.timezone}
            </p>

            <Link
              href="/settings"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Edit Profile
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Google Calendar
            </CardTitle>

            <CardDescription>
              Imported events appear on your calendar
              and Asteria events mirror back to Google.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage the connection, imported calendars,
              and two-way sync from Settings.
            </p>

            <Link
              href="/settings"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Manage Integration
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
