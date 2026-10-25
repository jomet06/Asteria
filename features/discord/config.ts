// Discord bot integration. The bot token stays server-side; the gateway
// runner (scripts/discord-bot.mjs) only bridges messages into the internal
// inbox API, so all business logic stays inside the Next.js backend.

export const DISCORD_API = "https://discord.com/api/v10";

export function discordBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  return token ? token : null;
}

export function discordInternalSecret(): string | null {
  const secret = process.env.DISCORD_INTERNAL_SECRET?.trim();
  return secret ? secret : null;
}

export function discordConfigured(): boolean {
  return Boolean(discordBotToken());
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
