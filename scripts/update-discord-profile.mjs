// Explicit, one-time profile update. Never runs with the gateway or app startup.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true });
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const expectedId = process.argv.find((arg) => arg.startsWith("--bot-id="))?.slice(9);
const apply = process.argv.includes("--apply");
const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
const description = "Your Asteria workspace assistant. Create tasks and calendar events, find free time, and receive reminders in private DMs.";

async function request(endpoint, method = "GET", body) {
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Discord ${method} ${endpoint}: HTTP ${response.status}`);
  return response.json();
}

try {
  if (!token || !expectedId) throw new Error("Provide DISCORD_BOT_TOKEN and --bot-id=<expected application id>.");
  const user = await request("/users/@me");
  if (!user.bot || user.id !== expectedId) throw new Error("Bot identity mismatch; no profile changes made.");
  if (apply) {
    const avatar = `data:image/png;base64,${(await readFile(new URL("../public/brand/asteria-bot-avatar.png", import.meta.url))).toString("base64")}`;
    await request("/users/@me", "PATCH", { username: "Asteria bot", avatar });
    await request("/applications/@me", "PATCH", { description, icon: avatar });
  }
  const verified = await request("/users/@me");
  const app = await request("/applications/@me");
  console.log(JSON.stringify({ applied: apply, id: verified.id, username: verified.username, displayName: verified.global_name ?? verified.username, avatarSet: Boolean(verified.avatar), applicationName: app.name, applicationIconSet: Boolean(app.icon), description: app.description }));
  if (apply && (verified.username !== "Asteria bot" || !verified.avatar || !app.icon || app.description !== description)) {
    throw new Error("Profile verification incomplete. Check the Discord Developer Portal.");
  }
} catch (error) {
  console.error(error instanceof Error && !error.cause ? error.message : "Discord profile request failed; credentials were not logged.");
  process.exitCode = 1;
}
