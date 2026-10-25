/* Offline checks for the Discord bridge: inbox linking, Hermes passthrough,
 * reminder tick dedupe, and the REST helper. No network or live database.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);

function createLoader() {
  const cache = new Map();
  return function load(file, mocks) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const entry = { exports: {} };
    cache.set(file, entry);
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    function require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith(".") || name.startsWith("@/")) {
        const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
        for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return load(base + ext, mocks);
      }
      return nativeRequire(name);
    }
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(require, entry, entry.exports);
    return entry.exports;
  };
}

const OWNER = "11111111-1111-4111-8111-111111111111";
const DISCORD_USER = "424242424242424242";
const CHANNEL = "555555555555555555";
const TASK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

process.env.DISCORD_BOT_TOKEN = "test-bot-token";
process.env.DISCORD_INTERNAL_SECRET = "test-secret";

function fakePrisma({ connections = [], profileTimezone = "Asia/Jakarta", openTasks = [], overdueTasks = [], planItems = [] } = {}) {
  const calls = { inboxConnections: [], logCreated: [], logDeleted: [], codes: [] };
  let codes = [];
  const prisma = {
    discordConnection: {
      findUnique: async ({ where }) => {
        calls.inboxConnections.push(where);
        return connections.find((connection) => connection.discordUserId === where.discordUserId) ?? null;
      },
      upsert: async ({ where, create, update }) => {
        const existing = connections.find((connection) => connection.discordUserId === where.discordUserId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { dmChannelId: null, ...create };
        connections.push(created);
        return created;
      },
      update: async ({ where, data }) => {
        const connection = connections.find((row) => row.ownerId === where.ownerId);
        if (connection) Object.assign(connection, data);
        return connection;
      },
      findMany: async () => connections,
      deleteMany: async ({ where }) => {
        for (let index = connections.length - 1; index >= 0; index -= 1) {
          if (connections[index].ownerId === where.ownerId) connections.splice(index, 1);
        }
        return { count: 1 };
      },
    },
    discordLinkCode: {
      findUnique: async ({ where }) => codes.find((code) => code.code === where.code) ?? null,
      deleteMany: async () => ({ count: 0 }),
      delete: async ({ where }) => {
        codes = codes.filter((code) => code.code !== where.code);
        return {};
      },
      create: async ({ data }) => {
        codes.push(data);
        return data;
      },
      deleteAll: () => { codes = []; },
      get codes() { return codes; },
    },
    profile: { findUnique: async () => ({ timezone: profileTimezone }) },
    task: {
      findMany: async ({ where }) => {
        // Deadlines have a gte bound; the overdue query only bounds with lt.
        if (where.dueAt?.gte) return openTasks;
        if (where.dueAt?.lt) return overdueTasks;
        return [];
      },
    },
    dailyPlanItem: {
      findMany: async () => planItems,
    },
    notificationLog: {
      createMany: async ({ data }) => {
        const duplicate = calls.logCreated.some(
          (row) => row.ownerId === data[0].ownerId && row.kind === data[0].kind && row.refKey === data[0].refKey
        );
        if (duplicate) return { count: 0 };
        calls.logCreated.push(...data);
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        calls.logDeleted.push(where);
        return { count: 1 };
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  return { prisma, calls, get codes() { return codes; } };
}

function restCalls() {
  const calls = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { calls, restore: () => { globalThis.fetch = previous; } };
}

function requestPayload(body, secret = "test-secret") {
  return new Request("http://localhost/api/discord/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-asteria-secret": secret },
    body: JSON.stringify(body),
  });
}

function inboxMocks({ prisma, hermesReply = "Done!", hermesThrows = false } = {}) {
  return {
    "@/lib/prisma": { prisma },
    "@/features/hermes/agent": {
      runHermesAgent: async () => {
        if (hermesThrows) throw new Error("gemini down");
        return { reply: hermesReply, tools: [] };
      },
      sanitizeHistory: (input) => (Array.isArray(input) ? input : []),
    },
  };
}

test("inbox rejects requests without the shared secret", async () => {
  const { prisma } = fakePrisma();
  const load = createLoader();
  const route = load(path.join(root, "app/api/discord/inbox/route.ts"), inboxMocks({ prisma }));

  const response = await route.POST(requestPayload({ discordUserId: DISCORD_USER, channelId: CHANNEL, content: "hi" }, "wrong-secret"));
  assert.equal(response.status, 401);
});

test("link codes bind a Discord user and confirm in the DM", async () => {
  const store = fakePrisma();
  store.prisma.discordLinkCode.create({ data: { code: "AB12CD", ownerId: OWNER, expiresAt: new Date(Date.now() + 600_000) } });
  const load = createLoader();
  const route = load(path.join(root, "app/api/discord/inbox/route.ts"), inboxMocks({ prisma: store.prisma }));
  const rest = restCalls();

  try {
    const response = await route.POST(requestPayload({
      discordUserId: DISCORD_USER, discordUsername: "jonathan", channelId: CHANNEL, content: "link AB12CD",
    }));
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(store.calls.inboxConnections.length, 1);

    const sent = rest.calls.at(-1);
    assert.ok(sent.url.includes(`/channels/${CHANNEL}/messages`));
    assert.match(sent.body.content, /Linked to Asteria/);
    assert.equal(store.codes.length, 0, "code is consumed after linking");
  } finally {
    rest.restore();
  }
});

test("unknown users get link instructions; linked users reach Hermes", async () => {
  const { prisma } = fakePrisma();
  const load = createLoader();
  const route = load(path.join(root, "app/api/discord/inbox/route.ts"), inboxMocks({ prisma, hermesReply: "Created the task." }));

  const rest = restCalls();
  try {
    await route.POST(requestPayload({ discordUserId: DISCORD_USER, channelId: CHANNEL, content: "make a task" }));
    assert.match(rest.calls.at(-1).body.content, /link CODE/i);
  } finally {
    rest.restore();
  }

  const linkedStore = fakePrisma({ connections: [{ ownerId: OWNER, discordUserId: DISCORD_USER, discordUsername: "jonathan", dmChannelId: CHANNEL }] });
  const linkedRoute = createLoader()(path.join(root, "app/api/discord/inbox/route.ts"), inboxMocks({ prisma: linkedStore.prisma, hermesReply: "Created the task." }));
  const rest2 = restCalls();
  try {
    await linkedRoute.POST(requestPayload({ discordUserId: DISCORD_USER, channelId: CHANNEL, content: "make a task" }));
    assert.equal(rest2.calls.at(-1).body.content, "Created the task.");
  } finally {
    rest2.restore();
  }
});

test("reminder tick sends due notifications once and skips duplicates", async () => {
  const now = Date.now();
  const store = fakePrisma({
    connections: [{ ownerId: OWNER, discordUserId: DISCORD_USER, discordUsername: "jonathan", dmChannelId: CHANNEL }],
    openTasks: [{ id: TASK_A, title: "Report", dueAt: new Date(now + 3_600_000) }],
    planItems: [{ task: { title: "Report" } }],
  });
  const load = createLoader();
  // Pin the local hour to 08:00 so the daily-plan morning window is deterministic.
  const realDateTime = createLoader()(path.join(root, "features/calendar/date-time.ts"), {});
  const dateTimeMock = {
    ...realDateTime,
    formatCalendarLocal: (instant, timezone) => {
      const rendered = realDateTime.formatCalendarLocal(instant, timezone);
      return `${rendered.slice(0, 11)}08${rendered.slice(13)}`;
    },
  };
  const eventStartingSoon = {
    id: "event-1",
    title: "Standup",
    kind: "event",
    startsAt: new Date(now + 10 * 60_000).toISOString(),
    endsAt: new Date(now + 25 * 60_000).toISOString(),
    timezone: "Asia/Jakarta",
    isAllDay: false,
    recurrenceRule: null,
  };
  const notifications = load(path.join(root, "features/discord/notifications.ts"), {
    "@/lib/prisma": { prisma: store.prisma },
    "@/features/calendar/date-time": dateTimeMock,
    "@/features/calendar/data": {
      loadCalendarEvents: async () => ({ events: [eventStartingSoon], truncated: false, schemaPending: false }),
    },
  });
  const rest = restCalls();

  try {
    const first = await notifications.runDiscordReminderTick();
    assert.equal(first.sent, 3);
    const channels = new Set(rest.calls.map((call) => call.url));
    assert.equal(channels.size, 1);
    assert.ok(rest.calls.some((call) => call.body.content.includes("Standup")));

    const second = await notifications.runDiscordReminderTick();
    assert.equal(second.sent, 0, "identical reminders must be deduplicated");
  } finally {
    rest.restore();
  }
});

test("discord REST helper fails soft on rate limits", async () => {
  const load = createLoader();
  const { sendDiscordMessage } = load(path.join(root, "features/discord/rest.ts"), {});
  const previous = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  try {
    const result = await sendDiscordMessage(CHANNEL, "hello");
    assert.deepEqual(result, { ok: false, error: "rate_limited" });
  } finally {
    globalThis.fetch = previous;
  }
});

// Execute the actual runner with network, environment and timers replaced.
// Skip only ESM imports and dotenv bootstrapping, so no real credentials load.
function runnerHarness(dmOnly = true) {
  const file = path.join(root, "scripts/discord-bot.mjs");
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statements = source.statements.filter((statement) => !ts.isImportDeclaration(statement) &&
    !(ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) && statement.expression.expression.text === "config"));
  const code = ts.createPrinter().printFile(ts.factory.updateSourceFile(source, statements));
  const state = { requests: [], intervals: [], logs: [], exits: [], sockets: [], replyOk: true };
  class FakeSocket {
    sent = [];
    constructor() { state.sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
  }
  const context = vm.createContext({
    process: { argv: dmOnly ? ["node", file, "--dm-only"] : ["node", file],
      platform: "win32", env: { DISCORD_BOT_TOKEN: "offline-token", DISCORD_INTERNAL_SECRET: "offline-secret" },
      exit: (code) => state.exits.push(code) },
    WebSocket: FakeSocket, AbortSignal,
    console: { log: (value) => state.logs.push(value), error: (value) => state.logs.push(value) },
    setInterval: (callback, ms) => { state.intervals.push({ callback, ms }); return state.intervals.length; },
    clearInterval: () => {}, setTimeout: () => {},
    fetch: async (url, options) => { state.requests.push({ url, options }); return { ok: true, json: async () => ({ ok: state.replyOk }) }; },
  });
  const runner = vm.runInContext(`${code}\n({ handlePayload, onMessage })`, context);
  return { ...runner, state, socket: state.sockets[0] };
}

test("DM-only startup schedules no reminder ticks and requests only direct messages", () => {
  const { handlePayload, state, socket } = runnerHarness();
  assert.equal(state.intervals.length, 0);
  handlePayload({ op: 10, d: { heartbeat_interval: 45000 } }, socket);
  // Discord's documented DIRECT_MESSAGES bit is 12; GUILD_MESSAGES is bit 9.
  assert.equal(socket.sent[0].d.intents & (1 << 12), 4096, "must subscribe to DM events");
  assert.equal(socket.sent[0].d.intents & (1 << 9), 0, "must not subscribe to server messages");
  assert.equal(state.intervals.length, 1, "only the gateway heartbeat is scheduled");
});

test("runner declares online only after Discord READY", () => {
  const { handlePayload, state, socket } = runnerHarness();
  handlePayload({ op: 10, d: { heartbeat_interval: 45000 } }, socket);
  assert.equal(state.logs.some((value) => value.includes("is online")), false);
  handlePayload({ op: 0, t: "READY", s: 1, d: {} }, socket);
  assert.equal(state.logs.some((value) => value.includes("is online")), true);
});

test("runner ignores server messages, bot messages and empty DMs", async () => {
  const { onMessage, state } = runnerHarness();
  const message = { author: { id: DISCORD_USER, username: "tester" }, channel_id: CHANNEL, content: "hello" };
  await onMessage({ ...message, guild_id: "server" });
  await onMessage({ ...message, author: { ...message.author, bot: true } });
  await onMessage({ ...message, content: " " });
  assert.equal(state.requests.length, 0);
  await onMessage(message);
  assert.equal(state.requests.length, 1);
  assert.equal(state.requests[0].url, "http://127.0.0.1:3000/api/discord/inbox");
  assert.equal(JSON.parse(state.requests[0].options.body).channelId, CHANNEL);
});

test("runner stops instead of endlessly retrying an invalid token", () => {
  const { socket, state } = runnerHarness();
  socket.onclose({ code: 4004 });
  assert.deepEqual(state.exits, [1]);
  assert.equal(state.logs.some((value) => value.includes("offline-token")), false);
});

test("gateway DM dispatch reaches inbox and logs delivery without private content", async () => {
  const { handlePayload, state, socket } = runnerHarness();
  handlePayload({ op: 0, t: "MESSAGE_CREATE", s: 2, d: {
    author: { id: DISCORD_USER, username: "tester" }, channel_id: CHANNEL, content: "private pairing content",
  } }, socket);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.requests.length, 1);
  assert.ok(state.logs.some((value) => value.includes("reply delivered")));
  assert.equal(state.logs.some((value) => value.includes("private pairing content")), false);
});

test("runner reports a failed Discord reply even when inbox returned HTTP 200", async () => {
  const { onMessage, state } = runnerHarness();
  state.replyOk = false;
  await onMessage({ author: { id: DISCORD_USER }, channel_id: CHANNEL, content: "hello" });
  assert.ok(state.logs.some((value) => value.includes("could not deliver")));
  assert.equal(state.logs.some((value) => value.includes("reply delivered")), false);
});
