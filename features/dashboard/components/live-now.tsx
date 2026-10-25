"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCalendarLocal, type CalendarTimezone } from "@/features/calendar/date-time";

type LiveEvent = { title: string; startsAt: string; endsAt: string };

function minutesLeft(target: number, now: number): number {
  return Math.max(0, Math.round((target - now) / 60_000));
}

function countdown(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/**
 * Live "Now & Next" card: a ticking clock plus the ongoing event's progress
 * or a countdown to the next one. Re-renders itself every 30 seconds.
 */
export function LiveNowCard({
  timezone,
  ongoing,
  next,
}: {
  timezone: CalendarTimezone;
  ongoing: LiveEvent | null;
  next: LiveEvent | null;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const clock = formatCalendarLocal(new Date(now), timezone).slice(11, 16);
  const progress =
    ongoing && Date.parse(ongoing.endsAt) > now
      ? Math.min(
          100,
          Math.max(
            0,
            ((now - Date.parse(ongoing.startsAt)) /
              (Date.parse(ongoing.endsAt) - Date.parse(ongoing.startsAt))) *
              100,
          ),
        )
      : 0;

  return (
    <Card className="h-full transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Clock3 className="size-5 text-primary" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {clock}
            <span className="ml-1 text-xs font-medium text-muted-foreground">{timezone.split("/").pop()}</span>
          </p>
        </div>
        <CardTitle>Now &amp; Next</CardTitle>
        <CardDescription>Where you are in today&apos;s schedule.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {ongoing && Date.parse(ongoing.endsAt) > now ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Happening now</p>
            <p className="mt-1 truncate font-semibold">{ongoing.title}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round(progress)}% done · ends in {countdown(minutesLeft(Date.parse(ongoing.endsAt), now))}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">Nothing is happening right now.</p>
        )}

        {next && Date.parse(next.startsAt) > now ? (
          <div className="border-t pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Up next</p>
            <p className="mt-1 truncate font-medium">{next.title}</p>
            <p className="text-xs text-muted-foreground">
              starts in {countdown(minutesLeft(Date.parse(next.startsAt), now))} ·{" "}
              {formatCalendarLocal(next.startsAt, timezone).slice(11, 16)}
            </p>
          </div>
        ) : (
          !ongoing && <p className="text-muted-foreground">No more events scheduled for today.</p>
        )}

        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open Calendar <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
