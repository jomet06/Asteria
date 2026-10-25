export type NotificationKind = "event_starting" | "deadline_soon" | "task_overdue" | "daily_plan" | "plan_ready";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  discordEnabled: boolean;
  calendarEnabled: boolean;
  deadlineEnabled: boolean;
  overdueEnabled: boolean;
  plannerEnabled: boolean;
  eventLeadMinutes: number;
  deadlineLeadDays: number;
  morningHour: number;
  overdueRepeatDays: number;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationInbox = {
  items: NotificationItem[];
  unread: number;
  hasMore: boolean;
  nextCursor: string | null;
  schemaPending: boolean;
  enabled: boolean;
};

export type NotificationCandidate = {
  kind: NotificationKind;
  refKey: string;
  title: string;
  message: string;
  href: string;
  sourceType: "event" | "task" | "planner";
  sourceId: string;
  sourceVersion: string;
  scheduledAt: Date;
  expiresAt: Date;
};

export type NotificationActionResult = { ok: true } | { ok: false; error: string };
