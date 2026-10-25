
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CalendarSync,
  ListTodo,
  MessageCircle,
  Plus,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMyAccount } from "@/features/profile/data";
import { formatCalendarLocal, readCalendarTimezone } from "@/features/calendar/date-time";
import { googleCalendarConfigured } from "@/features/calendar/google/config";
import { getMyGoogleCalendarConnection } from "@/features/calendar/google/data";
import { discordConfigured } from "@/features/discord/config";
import { getMyDiscordConnection } from "@/features/discord/data";
import { getMyDashboardOverview } from "@/features/dashboard/data";
import { LiveNowCard } from "@/features/dashboard/components/live-now";
import {
  DailyPlanCard,
  DeadlinesCard,
  RemindersCard,
  ScheduleCard,
  TodaysTasksCard,
} from "@/features/dashboard/components/dashboard-widgets";

export const instant = false;

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Saturday, 25 October" — the day always precedes the month. */
function todayLabel(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

const quickLinks = [
  { href: "/calendar", title: "Calendar", blurb: "Events, recurrence, and two-way Google sync.", icon: CalendarDays, accent: "bg-sky-500/10 text-sky-500" },
  { href: "/tasks", title: "To-Do List", blurb: "Tasks, projects, priorities, and dependencies.", icon: ListTodo, accent: "bg-emerald-500/10 text-emerald-500" },
  { href: "/hermes", title: "Hermes AI", blurb: "Ask, plan, and act across your workspace.", icon: Bot, accent: "bg-violet-500/10 text-violet-500" },
];

export default async function DashboardPage() {
  const { user, profile } = await getMyAccount();
  const overview = await getMyDashboardOverview();
  const timezone = readCalendarTimezone(profile.timezone);

  const displayName =
    profile.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  const hour = Number(formatCalendarLocal(overview.now, timezone).slice(11, 13));
  const openToday = overview.todaysTasks.filter((task) => !task.done).length;

  const [googleConnection, discordConnection] = await Promise.all([
    googleCalendarConfigured() ? getMyGoogleCalendarConnection() : null,
    discordConfigured() ? getMyDiscordConnection() : null,
  ]);

  const stats = [
    { label: "events today", value: overview.events.length, tone: "text-sky-500" },
    { label: "tasks due today", value: openToday, tone: "text-emerald-500" },
    { label: "in daily plan", value: overview.planTasks.length, tone: "text-violet-500" },
    { label: "overdue", value: overview.reminders.length, tone: overview.reminders.length ? "text-destructive" : "text-muted-foreground" },
  ];

  return (
    <AppShell activePage="dashboard">
      <div className="space-y-8">
        {/* HERO */}
        <header className="rounded-3xl border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {todayLabel(overview.now, timezone)} · {timezone}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting(hour)}, {displayName}!
              </h1>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Here is what today looks like across your schedule, tasks, and plans.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/tasks" className={buttonVariants({ variant: "outline" })}>
                <Plus className="size-4" aria-hidden="true" />
                New task
              </Link>
              <Link href="/calendar" className={buttonVariants()}>
                <Plus className="size-4" aria-hidden="true" />
                New event
              </Link>
            </div>
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border bg-background p-4 transition-colors hover:border-primary/30">
                <dd className={`text-2xl font-bold tabular-nums tracking-tight ${stat.tone}`}>
                  {stat.value}
                </dd>
                <dt className="mt-0.5 text-xs text-muted-foreground">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </header>

        {/* TODAY WIDGETS */}
        <section aria-label="Today at a glance" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LiveNowCard
            timezone={overview.timezone}
            ongoing={overview.ongoing ? { title: overview.ongoing.title, startsAt: overview.ongoing.startsAt, endsAt: overview.ongoing.endsAt } : null}
            next={overview.next ? { title: overview.next.title, startsAt: overview.next.startsAt, endsAt: overview.next.endsAt } : null}
          />
          <ScheduleCard overview={overview} />
          <TodaysTasksCard overview={overview} />
          <DailyPlanCard overview={overview} />
          <DeadlinesCard overview={overview} />
          <RemindersCard overview={overview} />
        </section>

        {/* QUICK LINKS */}
        <section aria-labelledby="quick-links-title">
          <h2 id="quick-links-title" className="mb-4 text-xl font-semibold">
            Your Workspace
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col rounded-2xl border bg-card p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={`mb-4 flex size-11 items-center justify-center rounded-xl ${link.accent}`}>
                  <link.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-semibold">{link.title}</span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {link.blurb}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Open
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section aria-labelledby="integrations-title" className="grid gap-4 md:grid-cols-2">
          <h2 id="integrations-title" className="sr-only">
            Integrations
          </h2>
          <Card className="transition-all duration-300 hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10">
                  <CalendarSync className="size-5 text-sky-500" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle>Google Calendar</CardTitle>
                  <CardDescription className="truncate">
                    {googleConnection
                      ? `Connected to ${googleConnection.googleEmail ?? "your Google account"}`
                      : "Not connected yet"}
                  </CardDescription>
                </div>
                <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Manage <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </CardHeader>
          </Card>

          <Card className="transition-all duration-300 hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10">
                  <MessageCircle className="size-5 text-indigo-500" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle>Discord</CardTitle>
                  <CardDescription className="truncate">
                    {discordConnection
                      ? `Linked to ${discordConnection.discordUsername}`
                      : "Reminders and chat via your DMs"}
                  </CardDescription>
                </div>
                <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Manage <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </CardHeader>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
