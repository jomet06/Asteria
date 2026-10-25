#!/usr/bin/env node
/* Discord gateway bridge for Asteria.
 *
 * A thin, long-running process that:
 *  1. relays direct messages into the backend inbox API, and
 *  2. ticks the reminder pipeline every minute.
 *
 * All business logic lives in the Next.js backend; this script only
 * speaks the Discord gateway protocol. Run alongside `npm run dev`:
 *   node scripts/discord-bot.mjs
 */
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Parse quoted values, comments and Windows line endings correctly. Existing
// environment variables still take precedence over the local file.
config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true });

const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim();
const SECRET = process.env.DISCORD_INTERNAL_SECRET?.trim();
const BASE = process.env.ASTERIA_INTERNAL_URL?.trim() || "http://127.0.0.1:3000";
// Chat-only setup avoids running the reminder pipeline or its database writes.
const REMINDERS_ENABLED = !process.argv.includes("--dm-only");

if (!TOKEN || !SECRET) {
  console.error("[discord-bot] DISCORD_BOT_TOKEN and DISCORD_INTERNAL_SECRET must be set in .env.local");
  process.exit(1);
}

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
// Only DIRECT_MESSAGES: no server events or privileged message-content access.
const INTENTS = 1 << 12;
const TICK_INTERVAL_MS = 60_000;

let heartbeatTimer = null;
let sequence = null;

function connect() {
  console.log("[discord-bot] connecting to gateway…");
  const socket = new WebSocket(GATEWAY_URL);

  socket.onmessage = (event) => {
    try {
      handlePayload(JSON.parse(String(event.data)), socket);
    } catch (error) {
      console.error("[discord-bot] bad gateway payload:", error.message);
    }
  };

  socket.onclose = (event) => {
    clearInterval(heartbeatTimer);
    if ([4004, 4010, 4011, 4012, 4013, 4014].includes(event.code)) {
      console.error(`[discord-bot] gateway rejected configuration (code ${event.code}); stopped`);
      process.exit(1);
    }
    console.error(`[discord-bot] gateway closed (code ${event.code}); reconnecting in 5s`);
    setTimeout(connect, 5000);
  };

  socket.onerror = () => {
    console.error("[discord-bot] gateway error");
  };
}

function handlePayload(payload, socket) {
  if (payload.op === 10) {
    // HELLO — identify and start heartbeats.
    sequence = null;
    socket.send(JSON.stringify({
      op: 2,
      d: {
        token: TOKEN,
        intents: INTENTS,
        properties: { os: process.platform, browser: "asteria", device: "asteria" },
      },
    }));
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      try {
        socket.send(JSON.stringify({ op: 1, d: sequence }));
      } catch {
        // A closed socket triggers onclose → reconnect.
      }
    }, payload.d.heartbeat_interval ?? 41250);
    console.log("[discord-bot] identifying…");
    return;
  }

  if (payload.op === 11) return; // heartbeat ack

  if (payload.op === 0) {
    sequence = payload.s;
    if (payload.t === "READY") console.log("[discord-bot] READY — Asteria is online for private DMs");
    if (payload.t === "MESSAGE_CREATE") void onMessage(payload.d);
  }
}

async function onMessage(message) {
  if (message.author?.bot) return;
  if (message.guild_id) return; // DMs only for now
  const content = String(message.content ?? "").trim();
  if (!content) return;
  console.log("[discord-bot] private DM received");

  try {
    const response = await fetch(`${BASE}/api/discord/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-asteria-secret": SECRET },
      body: JSON.stringify({
        discordUserId: message.author.id,
        discordUsername: message.author.global_name ?? message.author.username ?? "unknown",
        channelId: message.channel_id,
        content,
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!response.ok) {
      console.error(`[discord-bot] inbox rejected a message (HTTP ${response.status})`);
      return;
    }
    const result = await response.json();
    if (!result.ok) console.error("[discord-bot] backend could not deliver the DM reply");
    else console.log("[discord-bot] private DM reply delivered");
  } catch (error) {
    console.error("[discord-bot] inbox error:", error.message);
  }
}

let tickRunning = false;
async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const response = await fetch(`${BASE}/api/discord/tick`, {
      method: "POST",
      headers: { "x-asteria-secret": SECRET },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      console.error(`[discord-bot] scheduler rejected tick (HTTP ${response.status})`);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.sent > 0) console.log(`[discord-bot] reminders sent: ${data.sent}`);
  } catch (error) {
    console.error("[discord-bot] tick error:", error.message);
  } finally {
    tickRunning = false;
  }
}

connect();
if (REMINDERS_ENABLED) setInterval(tick, TICK_INTERVAL_MS);
console.log(`[discord-bot] running — backend ${BASE}, ${REMINDERS_ENABLED ? `ticking every ${TICK_INTERVAL_MS / 1000}s` : "private DM chat only; automatic reminders disabled"}`);
