import { DISCORD_API, discordBotToken } from "./config";

const TIMEOUT_MS = 10_000;
const MAX_MESSAGE = 1900;

/** Send a text message to a Discord channel/DM via the bot REST API. */
export async function sendDiscordMessage(
  channelId: string,
  content: string
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean; retryAfterMs?: number }> {
  const token = discordBotToken();
  if (!token) return { ok: false, error: "not_configured", retryable: true };
  if (!channelId) return { ok: false, error: "missing_channel", retryable: false };

  try {
    const response = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${token}`,
      },
      body: JSON.stringify({ content: content.slice(0, MAX_MESSAGE), allowed_mentions: { parse: [] } }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Never surface response bodies (they can echo message content).
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        const seconds = Number(body?.retry_after ?? response.headers.get("retry-after") ?? 30);
        return { ok: false, error: "rate_limited", retryable: true, retryAfterMs: Number.isFinite(seconds) ? Math.max(0, Math.min(3600, seconds)) * 1000 : 30_000 };
      }
      return { ok: false, error: "discord_request_failed", retryable: response.status >= 500 || response.status === 408 };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "discord_unreachable", retryable: true };
  }
}
