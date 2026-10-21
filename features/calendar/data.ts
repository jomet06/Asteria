
import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

import {
  calendarMonthRange,
  readCalendarMonth,
  readCalendarTimezone,
  type CalendarTimezone,
} from "./date-time";

export type CalendarEventView = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timezone: CalendarTimezone;
  isAllDay: boolean;
  recurrenceRule: string | null;
};

export async function getMyCalendarMonth(
  requestedMonth: unknown
) {
  const { user, profile } =
    await getMyAccount();

  const timezone = readCalendarTimezone(
    profile.timezone
  );

  const month = readCalendarMonth(
    requestedMonth,
    timezone
  );

  const range = calendarMonthRange(
    month,
    timezone
  );

  const rows =
    await prisma.calendarEvent.findMany({
      where: {
        ownerId: user.id,

        // Include events overlapping
        // the selected month.
        startsAt: {
          lt: range.to,
        },
        endsAt: {
          gt: range.from,
        },
      },

      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        isAllDay: true,
        recurrenceRule: true,
      },

      orderBy: [
        { startsAt: "asc" },
        { id: "asc" },
      ],

      take: 200,
    });

  const events: CalendarEventView[] =
    rows.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: readCalendarTimezone(
        event.timezone
      ),
      isAllDay: event.isAllDay,
      recurrenceRule: event.recurrenceRule,
    }));

  return {
    events,
    timezone,
    month,
    monthLabel: range.label,
    previousMonth: range.previousMonth,
    nextMonth: range.nextMonth,
    limit: 200,
  };
}
