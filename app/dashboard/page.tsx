
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Clock3,
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
    title: "Task & Daily Planner",
    description:
      "Organize priorities, projects, and daily activities.",
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
          Your personal dashboard is ready. This is
          where your schedule, tasks, and intelligent
          daily planning will come together.
        </p>
      </div>

      <section aria-labelledby="modules-title">
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
                  <span className="text-xs font-medium text-muted-foreground">
                    Coming Soon
                  </span>
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
              Profile & Preferences
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
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
              <Clock3 className="size-5" />
            </div>

            <CardTitle>
              Daily Overview
            </CardTitle>

            <CardDescription>
              A snapshot of your upcoming day.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Calendar and task summaries will
              appear here after the productivity
              modules are implemented.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
