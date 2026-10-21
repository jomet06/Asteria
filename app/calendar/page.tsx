
import { connection } from "next/server";

import { AppShell } from "@/components/app-shell";

import {
  getMyCalendarMonth,
} from "@/features/calendar/data";

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/features/calendar/actions";

import {
  EventManager,
} from "@/features/calendar/components/event-manager";

export const instant = false;

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string | string[];
  }>;
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  await connection();

  const params = await searchParams;

  // Reject duplicate or malformed month values.
  const requestedMonth =
    typeof params.month === "string"
      ? params.month
      : null;

  const calendar =
    await getMyCalendarMonth(
      requestedMonth
    );

  return (
    <AppShell
      activePage="calendar"
      workspace
    >
      <div className="px-4 py-8 sm:px-6">
        <EventManager
          {...calendar}
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
