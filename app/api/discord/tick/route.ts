import { discordBotToken, discordInternalSecret, timingSafeEqualStrings } from "@/features/discord/config";
import { runDiscordReminderTick } from "@/features/discord/notifications";

// Internal tick target for the bot runner: evaluates reminder triggers
// and pushes due notifications. Secret-gated, idempotent via the log.

export async function POST(request: Request) {
  const secret = discordInternalSecret();
  if (!secret || !timingSafeEqualStrings(request.headers.get("x-asteria-secret") ?? "", secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!discordBotToken()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const result = await runDiscordReminderTick();
  return Response.json(result);
}
