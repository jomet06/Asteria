
/**
 * Daily Planner date utilities.
 *
 * Planned dates represent calendar days,
 * not times or timestamps.
 */

// Convert YYYY-MM-DD into a valid UTC Date.
export function parsePlannerDate(
  value: unknown
): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  // Accept only YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Reject impossible dates such as 2026-02-30.
  if (
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

// Convert a date back to YYYY-MM-DD.
export function formatPlannerDate(
  date: Date
): string {
  return date.toISOString().slice(0, 10);
}
