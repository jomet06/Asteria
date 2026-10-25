import { discordInternalSecret, timingSafeEqualStrings } from "@/features/discord/config";
import { runDiscordReminderTick } from "@/features/discord/notifications";

export const maxDuration = 60;

// Legacy runner endpoint uses the same scheduler/leases as /notifications/tick.

export async function POST(request: Request) {
  const secret = discordInternalSecret();
  if (!secret || !timingSafeEqualStrings(request.headers.get("x-asteria-secret") ?? "", secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDiscordReminderTick();
    return Response.json(result, { status: result.schemaPending ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "scheduler_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
