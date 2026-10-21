import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";
import { getMyCalendarMonth } from "@/features/calendar/data";
import {
  calendarMonthRange,
  formatCalendarLocal,
  isCalendarDay,
} from "@/features/calendar/date-time";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/features/calendar/actions";
import { EventManager } from "@/features/calendar/components/event-manager";
import {
  CalendarViews,
  type CalendarDisplayView,
} from "@/features/calendar/components/calendar-views";

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
  const view: CalendarDisplayView =
    params.view === "week" || params.view === "day" ? params.view : "month";

  // The visual grid includes adjacent days. Keep the legacy
  // event-management list limited to events overlapping this month.
  const { from, to } = calendarMonthRange(calendar.month, calendar.timezone);
  const monthEvents = calendar.events.filter((event) =>
    Date.parse(event.startsAt) < to.getTime() &&
    Date.parse(event.endsAt) > from.getTime()
  );

  return (
    <AppShell activePage="calendar" workspace>
      <div className="space-y-10 px-4 py-8 sm:px-6">
        {calendar.schemaPending && (
          <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Your calendar is available to view. Creating and editing events will be available after the calendar update is completed.
          </p>
        )}
        <CalendarViews
          view={view}
          selectedDate={selectedDate}
          today={today}
          timezone={calendar.timezone}
          events={calendar.events}
          truncated={calendar.truncated}
        />
        <div id="event-manager" className="scroll-mt-6">
          <EventManager
            {...calendar}
            events={monthEvents.filter((event) => event.kind === "event" || event.kind === "block")}
            actions={{
              create: createCalendarEvent,
              update: updateCalendarEvent,
              remove: deleteCalendarEvent,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
