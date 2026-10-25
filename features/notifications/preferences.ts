import type { NotificationKind, NotificationPreferences } from "./types";

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true, discordEnabled: true,
  calendarEnabled: true, deadlineEnabled: true, overdueEnabled: true, plannerEnabled: true,
  eventLeadMinutes: 15, deadlineLeadDays: 1, morningHour: 7, overdueRepeatDays: 1,
};

export function categoryEnabled(preferences: NotificationPreferences, kind: string): boolean {
  switch (kind as NotificationKind) {
    case "event_starting": return preferences.calendarEnabled;
    case "deadline_soon": return preferences.deadlineEnabled;
    case "task_overdue": return preferences.overdueEnabled;
    case "daily_plan": case "plan_ready": return preferences.plannerEnabled;
    default: return false;
  }
}

export function parsePreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  // Explicit whitelist: clients cannot change owner, cursors, or delivery state.
  if (Object.keys(input).some((key) => !Object.hasOwn(DEFAULT_PREFERENCES, key))) return null;
  const result = { ...DEFAULT_PREFERENCES };
  for (const key of ["inAppEnabled", "discordEnabled", "calendarEnabled", "deadlineEnabled", "overdueEnabled", "plannerEnabled"] as const) {
    if (typeof input[key] !== "boolean") return null;
    result[key] = input[key];
  }
  for (const [key, allowed] of [
    ["eventLeadMinutes", [5, 10, 15, 30, 60]],
    ["deadlineLeadDays", [0, 1, 2, 3, 7]],
    ["morningHour", Array.from({ length: 12 }, (_, hour) => hour)],
    ["overdueRepeatDays", [0, 1]],
  ] as const) {
    const entry = input[key];
    if (typeof entry !== "number" || !(allowed as readonly number[]).includes(entry)) return null;
    result[key] = entry;
  }
  return result;
}

export function publicPreferences(value: NotificationPreferences): NotificationPreferences {
  return Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((key) => [key, value[key as keyof NotificationPreferences]])) as NotificationPreferences;
}

/** Only missing notification schema is recoverable; unrelated DB failures must surface. */
export function notificationSchemaPending(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; meta?: unknown };
  return ["P2021", "P2022"].includes(value.code ?? "") && /notification[_\s]?(logs|preferences|deliveries|scheduler|log|preference|delivery)/i.test(JSON.stringify(value.meta ?? {}));
}
