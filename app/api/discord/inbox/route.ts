import { prisma } from "@/lib/prisma";
import { readCalendarTimezone } from "@/features/calendar/date-time";
import { runHermesAgent } from "@/features/hermes/agent";
import { discordBotToken, discordInternalSecret, timingSafeEqualStrings } from "@/features/discord/config";
import { connectByCode } from "@/features/discord/link";
import { sendDiscordMessage } from "@/features/discord/rest";

// Internal bridge target for scripts/discord-bot.mjs (gateway runner).
// Authenticated with the shared DISCORD_INTERNAL_SECRET; all business
// logic (linking, Hermes, persistence) stays inside the backend.

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

const LINK_PATTERN = /^link\s+([A-Za-z0-9]{4,16})$/;

export async function POST(request: Request) {
  const secret = discordInternalSecret();
  if (!secret || !timingSafeEqualStrings(request.headers.get("x-asteria-secret") ?? "", secret)) {
    return unauthorized();
  }
  if (!discordBotToken()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let payload: {
    discordUserId?: unknown;
    discordUsername?: unknown;
    channelId?: unknown;
    content?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const discordUserId = typeof payload.discordUserId === "string" ? payload.discordUserId.trim().slice(0, 64) : "";
  const discordUsername = typeof payload.discordUsername === "string" ? payload.discordUsername.trim().slice(0, 120) : "unknown";
  const channelId = typeof payload.channelId === "string" ? payload.channelId.trim().slice(0, 64) : "";
  const content = typeof payload.content === "string" ? payload.content.trim().slice(0, 2000) : "";
  if (!discordUserId || !channelId || !content) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const connection = await prisma.discordConnection.findUnique({ where: { discordUserId } });
  const linkMatch = content.match(LINK_PATTERN);

  let reply: string;
  if (linkMatch) {
    const outcome = await connectByCode({
      discordUserId,
      discordUsername,
      dmChannelId: channelId,
      code: linkMatch[1],
    });
    reply = outcome.message;
  } else if (!connection) {
    reply =
      "👋 Hi! I'm the Asteria bot. To link this Discord account, open Asteria → Settings → Discord, generate a link code, then send:\n`link CODE`";
  } else {
    if (connection.dmChannelId !== channelId) {
      await prisma.discordConnection.update({
        where: { ownerId: connection.ownerId },
        data: { dmChannelId: channelId },
      });
    }
    const profile = await prisma.profile.findUnique({
      where: { id: connection.ownerId },
      select: { timezone: true },
    });
    try {
      const result = await runHermesAgent({
        ownerId: connection.ownerId,
        timezone: readCalendarTimezone(profile?.timezone),
        history: [],
        message: content,
      });
      reply = result.reply;
    } catch {
      reply = "Hermes is unavailable right now. Please try again shortly.";
    }
  }

  const sent = await sendDiscordMessage(channelId, reply);
  return Response.json({ ok: sent.ok, replyLength: reply.length });
}
