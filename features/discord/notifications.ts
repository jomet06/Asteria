// Compatibility entry point: both scheduler endpoints share one durable queue.
export { runNotificationTick as runDiscordReminderTick } from "@/features/notifications/scheduler";
export type { TickResult } from "@/features/notifications/scheduler";
