
export const CALENDAR_TIMEZONES = [
  {
    value: "Asia/Jakarta",
    label: "WIB — Jakarta (UTC+7)",
    offsetMinutes: 420,
  },
  {
    value: "Asia/Makassar",
    label: "WITA — Makassar (UTC+8)",
    offsetMinutes: 480,
  },
  {
    value: "Asia/Jayapura",
    label: "WIT — Jayapura (UTC+9)",
    offsetMinutes: 540,
  },
  {
    value: "UTC",
    label: "UTC (UTC+0)",
    offsetMinutes: 0,
  },
] as const;

export type CalendarTimezone =
  (typeof CALENDAR_TIMEZONES)[number]["value"];

const DAY_MS = 86_400_000;

export function isCalendarTimezone(
  value: unknown
): value is CalendarTimezone {
  return (
    typeof value === "string" &&
    CALENDAR_TIMEZONES.some(
      (zone) => zone.value === value
    )
  );
}

export function readCalendarTimezone(
  value: unknown
): CalendarTimezone {
  return isCalendarTimezone(value)
    ? value
    : "Asia/Jakarta";
}

function offsetFor(
  timezone: CalendarTimezone
): number {
  return (
    CALENDAR_TIMEZONES.find(
      (zone) => zone.value === timezone
    )?.offsetMinutes ?? 0
  );
}

type DayParts = {
  year: number;
  month: number;
  day: number;
};

function parseDayParts(
  value: unknown
): DayParts | null {
  if (
    typeof value !== "string" ||
    !/^(19\d{2}|20\d{2}|2100)-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return { year, month, day };
}

export function isCalendarDay(
  value: unknown
): value is string {
  return parseDayParts(value) !== null;
}

// Read YYYY-MM-DDTHH:mm as wall-clock time
// in one of Asteria's supported timezones.
export function parseCalendarLocal(
  value: unknown,
  timezone: CalendarTimezone
): Date | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const day = parseDayParts(
    value.slice(0, 10)
  );

  if (!day) return null;

  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));

  if (
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const utcMilliseconds =
    Date.UTC(
      day.year,
      day.month - 1,
      day.day,
      hour,
      minute
    ) -
    offsetFor(timezone) * 60_000;

  return new Date(utcMilliseconds);
}

// Convert a stored UTC instant into the
// user's selected wall-clock datetime.
export function formatCalendarLocal(
  instant: Date | string,
  timezone: CalendarTimezone
): string {
  const date =
    instant instanceof Date
      ? instant
      : new Date(instant);

  const localMilliseconds =
    date.getTime() +
    offsetFor(timezone) * 60_000;

  return new Date(localMilliseconds)
    .toISOString()
    .slice(0, 16);
}

// End date is inclusive in the form.
// The database stores exclusive ends.
export function parseAllDayRange(
  startDay: unknown,
  endDay: unknown,
  timezone: CalendarTimezone
): {
  startsAt: Date;
  endsAt: Date;
} | null {
  const startParts = parseDayParts(startDay);
  const endParts = parseDayParts(endDay);

  if (!startParts || !endParts) {
    return null;
  }

  const startsAt = parseCalendarLocal(
    `${startDay}T00:00`,
    timezone
  );

  if (!startsAt) return null;

  const endsAt = new Date(
    Date.UTC(
      endParts.year,
      endParts.month - 1,
      endParts.day + 1
    ) -
      offsetFor(timezone) * 60_000
  );

  if (
    endsAt.getTime() <= startsAt.getTime() ||
    endsAt.getTime() - startsAt.getTime() >
      366 * DAY_MS
  ) {
    return null;
  }

  return { startsAt, endsAt };
}

export function readCalendarMonth(
  value: unknown,
  timezone: CalendarTimezone
): string {
  if (
    typeof value === "string" &&
    /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(
      value
    )
  ) {
    return value;
  }

  return formatCalendarLocal(
    new Date(),
    timezone
  ).slice(0, 7);
}

export function calendarMonthRange(
  month: string,
  timezone: CalendarTimezone
) {
  const [year, number] =
    month.split("-").map(Number);

  const offset =
    offsetFor(timezone) * 60_000;

  const from = new Date(
    Date.UTC(year, number - 1, 1) - offset
  );

  const to = new Date(
    Date.UTC(year, number, 1) - offset
  );

  const previousMonth = new Date(
    Date.UTC(year, number - 2, 1)
  )
    .toISOString()
    .slice(0, 7);

  const nextMonth = new Date(
    Date.UTC(year, number, 1)
  )
    .toISOString()
    .slice(0, 7);

  const label = new Intl.DateTimeFormat(
    "en",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(Date.UTC(year, number - 1, 1))
  );

  return {
    from,
    to,
    previousMonth,
    nextMonth,
    label,
  };
}

export function previousAllDayDate(
  exclusiveEnd: Date | string,
  timezone: CalendarTimezone
): string {
  const date =
    exclusiveEnd instanceof Date
      ? exclusiveEnd
      : new Date(exclusiveEnd);

  return formatCalendarLocal(
    new Date(date.getTime() - DAY_MS),
    timezone
  ).slice(0, 10);
}
