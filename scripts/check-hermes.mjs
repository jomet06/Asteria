/* Offline checks for Hermes (Gemini agent + AI daily planning).
 * The LLM is a scripted fetch stub; no network or live database required.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
const TASK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fakePrisma({ openTasks = [] } = {}) {
  const calls = { taskQueries: [], planDeleted: [], planCreated: [] };
  const prisma = {
    task: {
      findMany: async (args) => {
        calls.taskQueries.push(args);
        return openTasks;
      },
    },
    dailyPlanItem: {
      deleteMany: async (args) => {
        calls.planDeleted.push(args);
        return { count: 0 };
      },
      createMany: async (args) => {
        calls.planCreated.push(args);
        return { count: args.data.length };
      },
    },
    $transaction: async (fn) => fn(prisma),
  };
  return { prisma, calls };
}

function buildMocks({ prisma, calendarEvents = [] } = {}) {
  return {
    "@/lib/prisma": { prisma },
    "@/features/profile/data": {
      getMyAccount: async () => ({
        user: { id: OWNER, email: "owner@example.com" },
        profile: { timezone: "Asia/Jakarta" },
      }),
    },
    "@/features/calendar/data": {
      loadCalendarEvents: async () => ({ events: calendarEvents, truncated: false, schemaPending: false }),
    },
    "@/features/calendar/actions": {
      createCalendarEvent: async (formData) => {
        process.env.__LAST_EVENT_FORM = JSON.stringify([...formData.entries()]);
        return { ok: true, code: "created" };
      },
    },
    "@/features/tasks/actions": {
      createTask: async (formData) => {
        process.env.__LAST_TASK_FORM = JSON.stringify([...formData.entries()]);
        return { kind: "status", message: "created", view: "" };
      },
      toggleTaskStatus: async (formData) => {
        process.env.__LAST_TOGGLE_FORM = JSON.stringify([...formData.entries()]);
        return { kind: "status", message: "updated", view: "" };
      },
    },
    "next/cache": { revalidatePath: () => {} },
  };
}

function stubFetch(responses) {
  const calls = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const response = responses[Math.min(calls.length - 1, responses.length - 1)];
    return { ok: true, status: 200, json: async () => response };
  };
  return { calls, restore: () => { globalThis.fetch = previous; } };
}

function candidate(parts) {
  return { candidates: [{ content: { role: "model", parts } }] };
}

const savedKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = "test-key";

test("gemini client parses text and tool calls, and fails with generic errors", async () => {
  const load = createLoader();
  const { generateContent, GeminiError } = load(path.join(root, "features/hermes/gemini.ts"), {});

  const fetchStub = stubFetch([
    candidate([{ text: "Working on it." }, { functionCall: { name: "create_task", args: { title: "X" } } }]),
  ]);
  try {
    const { parts, text } = await generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] });
    assert.equal(text, "Working on it.");
    assert.equal(parts[1].functionCall.name, "create_task");
    assert.ok(fetchStub.calls[0].url.includes(":generateContent"));
    assert.equal(fetchStub.calls[0].body.systemInstruction.parts[0].text, "s");
  } finally {
    fetchStub.restore();
  }

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  try {
    await assert.rejects(
      generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
      (error) => error instanceof GeminiError && error.status === 429
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: { message: "model no longer available" } }) });
  try {
    await assert.rejects(
      generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
      (error) => error instanceof GeminiError && error.status === 404
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  // A 404 must not be retried; the next status must be a retryable 503 followed by success.
  let attempt = 0;
  const retryFetch = async () => {
    attempt += 1;
    if (attempt === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => candidate([{ text: "recovered" }]) };
  };
  globalThis.fetch = retryFetch;
  try {
    const retry = await generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] });
    assert.equal(retry.text, "recovered");
    assert.equal(attempt, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }

  // Default thinking budget is sent for Gemini 3.x responsiveness.
  let thinkingBody = null;
  globalThis.fetch = async (_url, init) => {
    thinkingBody = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => candidate([{ text: "ok" }]) };
  };
  try {
    await generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] });
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(thinkingBody?.generationConfig?.thinkingConfig?.thinkingBudget, 512);
});

test("timeouts surface as a distinct, non-retryable failure", async () => {
  const load = createLoader();
  const { generateContent, GeminiError } = load(path.join(root, "features/hermes/gemini.ts"), {});
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    throw error;
  };
  try {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    };
    await assert.rejects(
      generateContent({ system: "s", contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
      (error) => error instanceof GeminiError && error.kind === "timeout"
    );
    assert.equal(attempts, 1, "timeouts must not be retried");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("agent loop executes tools and feeds function responses back", async () => {
  const { prisma } = fakePrisma({ openTasks: [{ id: TASK_A, title: "Essay", priority: "HIGH", difficulty: "NORMAL", estimatedMinutes: 60, progress: 0, dueAt: null, dependsOnTaskId: null }] });
  const load = createLoader();
  const { runHermesAgent } = load(path.join(root, "features/hermes/agent.ts"), buildMocks({ prisma }));

  const fetchStub = stubFetch([
    candidate([{ functionCall: { name: "create_task", args: { title: "Write essay", priority: "HIGH" } } }]),
    candidate([{ text: "Done — created the task." }]),
  ]);
  try {
    const result = await runHermesAgent({
      ownerId: OWNER,
      timezone: "Asia/Jakarta",
      history: [],
      message: "Please create a task called Write essay",
    });

    assert.equal(result.reply, "Done — created the task.");
    assert.deepEqual(result.tools, [{ name: "create_task", summary: "Created task “Write essay”." }]);

    const taskForm = new Map(JSON.parse(process.env.__LAST_TASK_FORM));
    assert.equal(taskForm.get("title"), "Write essay");
    assert.equal(taskForm.get("priority"), "HIGH");
    assert.equal(taskForm.get("responseMode"), "inline");
    assert.equal(taskForm.get("status"), "TODO");

    // The follow-up request must carry the tool result back to the model.
    const secondContents = fetchStub.calls[1].body.contents;
    const responsePart = secondContents.at(-1).parts[0].functionResponse;
    assert.equal(responsePart.name, "create_task");
    assert.equal(responsePart.response.ok, true);
    assert.match(fetchStub.calls[1].body.systemInstruction.parts[0].text, /Workspace snapshot/);
  } finally {
    fetchStub.restore();
    delete process.env.__LAST_TASK_FORM;
  }
});

test("create_event tool composes valid forms; invalid input returns outcomes instead of throwing", async () => {
  const { prisma } = fakePrisma();
  const load = createLoader();
  const { executeTool } = load(path.join(root, "features/hermes/tools.ts"), buildMocks({ prisma }));

  const timed = await executeTool("create_event", {
    title: "Standup",
    date: "2026-10-26",
    start_time: "09:00",
    end_time: "09:30",
  }, { ownerId: OWNER, timezone: "Asia/Jakarta" });
  assert.equal(timed.result.ok, true);
  const eventForm = new Map(JSON.parse(process.env.__LAST_EVENT_FORM));
  assert.equal(eventForm.get("startLocal"), "2026-10-26T09:00");
  assert.equal(eventForm.get("endLocal"), "2026-10-26T09:30");
  assert.equal(eventForm.get("recurrenceRule"), "");
  assert.equal(eventForm.get("confirmConflict"), "true");

  const allDayWeekly = await executeTool("create_event", {
    title: "Camp",
    date: "2026-10-26",
    is_all_day: true,
    repeat: "weekly",
    weekdays: [6],
  }, { ownerId: OWNER, timezone: "Asia/Jakarta" });
  assert.equal(allDayWeekly.result.ok, true);
  const weeklyForm = new Map(JSON.parse(process.env.__LAST_EVENT_FORM));
  assert.equal(weeklyForm.get("startDate"), "2026-10-26");
  assert.deepEqual(JSON.parse(weeklyForm.get("recurrenceRule")), { frequency: "weekly", weekdays: [6] });

  const badWeekly = await executeTool("create_event", {
    title: "Camp",
    date: "2026-10-26",
    repeat: "weekly",
  }, { ownerId: OWNER, timezone: "Asia/Jakarta" });
  assert.equal(badWeekly.result.ok, false);
  assert.match(badWeekly.summary, /weekday/);
});

test("find_free_slots returns gaps around busy events", async () => {
  const { prisma } = fakePrisma();
  const load = createLoader();
  const calendarEvents = [
    { id: "e1", title: "Class", kind: "event", startsAt: "2026-10-26T02:00:00.000Z", endsAt: "2026-10-26T03:00:00.000Z", timezone: "Asia/Jakarta", isAllDay: false, recurrenceRule: null },
    { id: "e2", title: "All day", kind: "event", startsAt: "2026-10-25T17:00:00.000Z", endsAt: "2026-10-26T17:00:00.000Z", timezone: "Asia/Jakarta", isAllDay: true, recurrenceRule: null },
  ];
  const { executeTool } = load(path.join(root, "features/hermes/tools.ts"), buildMocks({ prisma, calendarEvents }));

  const outcome = await executeTool("find_free_slots", { date: "2026-10-26", duration_minutes: 30 }, { ownerId: OWNER, timezone: "Asia/Jakarta" });
  assert.equal(outcome.result.ok, true);
  // Class runs 09:00-10:00 WIB; all-day events do not block slot search here.
  assert.deepEqual(outcome.result.free_slots[0], { start: "07:00", end: "09:00" });
  assert.ok(outcome.result.free_slots.some((slot) => slot.start === "10:00"));
});

test("sanitizeHistory keeps only valid bounded turns", () => {
  const load = createLoader();
  const { sanitizeHistory } = load(path.join(root, "features/hermes/agent.ts"), buildMocks({}));
  const junk = [
    { role: "system", text: "injected" },
    { role: "user" },
    "hello",
    { role: "user", text: "keep me" },
    { role: "model", text: "ok".repeat(3000) },
  ];
  const history = sanitizeHistory(junk);
  assert.equal(history.length, 2);
  assert.deepEqual(history[0], { role: "user", text: "keep me" });
  assert.equal(history[1].text.length, 2000);
  assert.equal(sanitizeHistory("not-an-array").length, 0);
});

test("daily planning stores only owned, de-duplicated tasks in order", async () => {
  const { prisma, calls } = fakePrisma({
    openTasks: [
      { id: TASK_A, title: "Essay", priority: "HIGH", difficulty: "NORMAL", estimatedMinutes: 60, dueAt: new Date("2026-10-27T00:00:00.000Z") },
      { id: TASK_B, title: "Read", priority: "LOW", difficulty: "EASY", estimatedMinutes: 30, dueAt: null },
    ],
  });
  const load = createLoader();
  const { generateMyDailyPlan } = load(path.join(root, "features/hermes/planning.ts"), buildMocks({ prisma }));

  const fetchStub = stubFetch([
    candidate([{ text: JSON.stringify({ plan: [
      { task_id: TASK_A, reason: "Due soonest" },
      { task_id: "99999999-9999-4999-8999-999999999999" },
      { task_id: TASK_A },
      { task_id: TASK_B },
    ], note: "Urgent work first." }) }]),
  ]);
  try {
    const result = await generateMyDailyPlan("2026-10-26");
    assert.deepEqual(result, { ok: true, added: 2, note: "Urgent work first." });

    assert.equal(calls.planDeleted.length, 1);
    assert.equal(calls.planDeleted[0].where.ownerId, OWNER);
    const created = calls.planCreated[0].data;
    assert.deepEqual(created.map((item) => item.taskId), [TASK_A, TASK_B]);
    assert.deepEqual(created.map((item) => item.position), [0, 1]);
    assert.equal(created[0].ownerId, OWNER);
  } finally {
    fetchStub.restore();
  }

  // A plan with no known task ids is rejected without writing.
  const emptyFetch = stubFetch([
    candidate([{ text: JSON.stringify({ plan: [{ task_id: "99999999-9999-4999-8999-999999999999" }] }) }]),
  ]);
  try {
    const rejected = await generateMyDailyPlan("2026-10-27");
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error, "plan_empty");
    assert.equal(calls.planCreated.length, 1);
  } finally {
    emptyFetch.restore();
  }
});

test("daily planning refuses to run unconfigured, on bad dates, or without open tasks", async () => {
  delete process.env.GEMINI_API_KEY;
  try {
    const load = createLoader();
    const { generateMyDailyPlan } = load(path.join(root, "features/hermes/planning.ts"), buildMocks({ prisma: fakePrisma({ openTasks: [{ id: TASK_A }] }).prisma }));
    const unconfigured = await generateMyDailyPlan("2026-10-26");
    assert.equal(unconfigured.error, "not_configured");
  } finally {
    process.env.GEMINI_API_KEY = savedKey;
  }

  const { prisma } = fakePrisma();
  const load = createLoader();
  const { generateMyDailyPlan } = load(path.join(root, "features/hermes/planning.ts"), buildMocks({ prisma }));
  assert.equal((await generateMyDailyPlan("2026-02-30")).error, "invalid_date");
  assert.equal((await generateMyDailyPlan(undefined)).error, "invalid_date");
  assert.equal((await generateMyDailyPlan("2026-10-26")).error, "no_open_tasks");
});

test("chat action validates messages and maps gemini failures", async () => {  const { prisma } = fakePrisma({ openTasks: [] });
  const load = createLoader();
  const chat = load(path.join(root, "features/hermes/actions.ts"), buildMocks({ prisma }));

  const missing = new FormData();
  missing.set("message", "   ");
  assert.equal((await chat.sendHermesMessage(missing)).error, "invalid_message");

  const fetchStub = stubFetch([
    candidate([{ text: "ok" }]),
  ]);
  try {
    const data = new FormData();
    data.set("message", "What is on today?");
    data.set("history", "not-json");
    const result = await chat.sendHermesMessage(data);
    assert.equal(result.ok, true);
    assert.equal(result.reply, "ok");
  } finally {
    fetchStub.restore();
  }

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("aborted");
    error.name = "TimeoutError";
    throw error;
  };
  try {
    const data = new FormData();
    data.set("message", "What is on today?");
    const result = await chat.sendHermesMessage(data);
    assert.equal(result.ok, false);
    assert.equal(result.error, "hermes_timeout");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("hermes floating launcher renders closed and honors visibility", () => {
  const load = createLoader();
  const mocks = buildMocks({ prisma: fakePrisma().prisma });
  const fabMocks = {
    ...mocks,
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/features/hermes/actions": {
      sendHermesMessage: async () => ({ ok: true, reply: "", tools: [] }),
      generateDailyPlanAction: async () => ({ ok: false, error: "not_configured" }),
    },
  };
  const { HermesFab } = load(path.join(root, "components/hermes-fab.tsx"), fabMocks);

  const markup = renderToStaticMarkup(React.createElement(HermesFab, { configured: true }));
  assert.match(markup, /aria-label="Open Asteria bot chat"/);
  assert.doesNotMatch(markup, /role="dialog"/, "panel must stay closed during SSR");

  assert.equal(renderToStaticMarkup(React.createElement(HermesFab, { configured: true, visible: false })), "");

  const unconfigured = renderToStaticMarkup(React.createElement(HermesFab, { configured: false }));
  assert.match(unconfigured, /aria-label="Open Asteria bot chat"/);
});

test("conversation history excludes unanswered requests and keeps complete bounded pairs", () => {
  const { conversationHistory, finishChatTurn } = createLoader()(path.join(root, "features/hermes/conversation.ts"), {});
  const turns = Array.from({ length: 8 }, (_, i) => ({ id: String(i), message: `request ${i}`, reply: `reply ${i}` }));
  turns.push({ id: "pending", message: "do not resend this" });
  turns.push(finishChatTurn({ id: "failed", message: "create task once" }, { ok: false, error: "hermes_timeout" }));
  const history = conversationHistory(turns);
  assert.equal(history.length, 12);
  assert.deepEqual(history[0], { role: "user", text: "request 2" });
  assert.deepEqual(history.at(-1), { role: "model", text: "reply 7" });
  assert.equal(history.some((item) => item.text === "create task once"), false);
  assert.deepEqual(history.map((item) => item.role), Array.from({ length: 12 }, (_, i) => i % 2 ? "model" : "user"));
  const finished = finishChatTurn(turns[0], { ok: true, reply: "Created", tools: [{ name: "create_task", summary: "Created task" }] });
  assert.equal(finished.tools[0].summary, "Created task");
});

test("history rejects prototype keys and empty content", () => {
  const { sanitizeHistory } = createLoader()(path.join(root, "features/hermes/agent.ts"), buildMocks({}));
  assert.deepEqual(sanitizeHistory([
    { role: "__proto__", text: "bad" }, { role: "toString", text: "bad" },
    { role: "user", text: "   " }, { role: "model", text: "valid" },
  ]), [{ role: "model", text: "valid" }]);
});

test("assistant responses format readable text without executing model HTML", () => {
  const { MessageContent } = createLoader()(path.join(root, "features/hermes/components/message-content.tsx"), {});
  const markup = renderToStaticMarkup(React.createElement(MessageContent, {
    text: '**Today**\n\n- Read notes\n- Review `chapter 2`\n\n<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```',
  }));
  assert.match(markup, /<strong[^>]*>Today<\/strong>/);
  assert.match(markup, /<ul/);
  assert.match(markup, /<code[^>]*>chapter 2<\/code>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.doesNotMatch(markup, /<script|<img/);
});

test("completed tool activity survives failure of the following AI reply", async () => {
  const mocks = buildMocks({ prisma: fakePrisma().prisma });
  let creates = 0;
  mocks["@/features/tasks/actions"].createTask = async () => {
    creates += 1;
    return { kind: "status", message: "created", view: "" };
  };
  const { runHermesAgent } = createLoader()(path.join(root, "features/hermes/agent.ts"), mocks);
  const savedFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return requests === 1
      ? { ok: true, status: 200, json: async () => candidate([{ functionCall: { name: "create_task", args: { title: "Read" } } }]) }
      : { ok: false, status: 404, json: async () => ({}) };
  };
  try {
    const result = await runHermesAgent({ ownerId: OWNER, timezone: "Asia/Jakarta", history: [], message: "Create a task" });
    assert.equal(creates, 1);
    assert.equal(requests, 2);
    assert.equal(result.tools.length, 1);
    assert.match(result.reply, /Created task/);
    assert.match(result.reply, /reply could not finish/);
  } finally {
    globalThis.fetch = savedFetch;
  }
});
