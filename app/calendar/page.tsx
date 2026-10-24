import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";
import { getMyCalendarMonth } from "@/features/calendar/data";
import {
  formatCalendarLocal,
  isCalendarDay,
} from "@/features/calendar/date-time";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/features/calendar/actions";
import { EventManager } from "@/features/calendar/components/event-manager";

export const instant = false;

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string | string[];
    date?: string | string[];
    view?: string | string[];
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await connection();
  const params = await searchParams;
  const date = isCalendarDay(params.date) ? params.date : null;
  const requestedMonth = date?.slice(0, 7) ??
    (typeof params.month === "string" ? params.month : null);

  const calendar = await getMyCalendarMonth(requestedMonth);
  const today = formatCalendarLocal(new Date(), calendar.timezone).slice(0, 10);
  const selectedDate = date ??
    (today.slice(0, 7) === calendar.month ? today : `${calendar.month}-01`);
  const view: "month" | "week" | "day" =
    params.view === "week" || params.view === "day" ? params.view : "month";

  return (
    <AppShell activePage="calendar" workspace>
      <div className="space-y-10 px-4 py-8 sm:px-6">
        {calendar.schemaPending && (
          <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Your calendar is available to view. Creating and editing events will be available after the calendar update is completed.
          </p>
        )}
        <EventManager
          {...calendar}
          view={view}
          selectedDate={selectedDate}
          today={today}
          actions={{
            create: createCalendarEvent,
            update: updateCalendarEvent,
            remove: deleteCalendarEvent,
          }}
        />
      </div>
    </AppShell>
  );
}
