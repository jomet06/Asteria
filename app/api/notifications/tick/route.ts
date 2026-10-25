import { timingSafeEqualStrings } from "@/features/discord/config";
import { runNotificationTick } from "@/features/notifications/scheduler";

export const maxDuration = 60;

/** Dedicated scheduler entry point, independent of browser sessions and DMs. */
export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_SCHEDULER_SECRET?.trim();
  if (!secret || !timingSafeEqualStrings(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runNotificationTick();
    return Response.json(result, { status: result.schemaPending ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "scheduler_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
