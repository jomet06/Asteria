/* Offline execution of the real notification services/actions/routes against an
 * isolated transactional store. Never reads .env, opens a socket, or sends DMs.
 * node --test scripts/check-notifications.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const T = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const U = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-10-25T01:00:00Z");

function loader(mocks = {}) {
  const cache = new Map();
  function load(name) {
    let file = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(name);
    if (mocks[file]) return mocks[file];
    if (!path.extname(file)) file += existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (cache.has(file)) return cache.get(file).exports;
    const moduleRecord = { exports: {} }; cache.set(file, moduleRecord);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const require = (spec) => {
      if (Object.hasOwn(mocks, spec)) return mocks[spec];
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const resolved = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec);
        const canonical = `@/${path.relative(root, resolved).replaceAll("\\", "/")}`;
        return mocks[canonical] ?? load(resolved);
      }
      return nativeRequire(spec);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(require, moduleRecord, moduleRecord.exports);
    return moduleRecord.exports;
  }
  return load;
}

function harness(options = {}) {
  const calls = [], sent = [], events = options.events ?? [];
  const tables = {
    profile: [{ id: A, timezone: "Asia/Jakarta" }, { id: B, timezone: "Asia/Jayapura" }],
    task: [], dailyPlanItem: [], notificationLog: [], notificationPreference: [], notificationDelivery: [], notificationSchedulerState: [], discordConnection: [], discordLinkCode: [],
  };
  const defaults = loader()("@/features/notifications/preferences").DEFAULT_PREFERENCES;
  const clone = (value) => value == null ? value : structuredClone(value);
  function matches(row, where = {}, model) {
    return Object.entries(where).every(([key, expected]) => {
      if (key === "OR") return expected.some((item) => matches(row, item, model));
      if (key === "AND") return expected.every((item) => matches(row, item, model));
      if (key === "notification") return matches(tables.notificationLog.find((item) => item.id === row.notificationId), expected, "notificationLog");
      if (key === "task") return matches(tables.task.find((item) => item.id === row.taskId), expected, "task");
      if (key === "ownerId_kind_refKey") return matches(row, expected, model);
      const value = row?.[key];
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        return Object.entries(expected).every(([op, target]) => {
          if (op === "in") return target.includes(value);
          if (op === "not") return value !== target;
          if (op === "gte") return value != null && value >= target;
          if (op === "gt") return value != null && value > target;
          if (op === "lte") return value != null && value <= target;
          if (op === "lt") return value != null && value < target;
          throw new Error(`Unsupported test predicate ${op}`);
        });
      }
      return expected instanceof Date ? value?.getTime() === expected.getTime() : value === expected;
    });
  }
  function rows(model, query = {}) {
    calls.push({ model, query: clone(query) });
    let result = tables[model].filter((row) => matches(row, query.where, model));
    const ordering = Array.isArray(query.orderBy) ? query.orderBy : query.orderBy ? [query.orderBy] : [];
    result = [...result].sort((left, right) => {
      for (const order of ordering) for (const [key, direction] of Object.entries(order)) {
        if (left[key] < right[key]) return direction === "asc" ? -1 : 1;
        if (left[key] > right[key]) return direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return query.take ? result.slice(0, query.take) : result;
  }
  const prisma = {};
  for (const model of Object.keys(tables)) {
    const create = (data) => {
      const row = {
        id: randomUUID(), createdAt: new Date(),
        ...(model === "notificationPreference" ? { ...defaults, taskCursor: null, plannerCursor: null } : {}),
        ...(model === "notificationLog" ? { title: null, readAt: null, dismissedAt: null, inApp: false, legacyDiscordSent: false } : {}),
        ...(model === "notificationDelivery" ? { channel: "discord", status: "pending", attempts: 0, nextAttemptAt: new Date(), claimToken: null, leaseUntil: null } : {}),
        ...(model === "notificationSchedulerState" ? { ownerCursor: null, deliveryCursor: null, leaseUntil: null, leaseToken: null } : {}), ...clone(data),
      };
      const duplicate = tables[model].some((old) => model === "notificationLog" ? old.ownerId === row.ownerId && old.kind === row.kind && old.refKey === row.refKey : model === "notificationDelivery" ? old.notificationId === row.notificationId && old.channel === row.channel : model === "discordConnection" ? old.ownerId === row.ownerId || old.discordUserId === row.discordUserId : model === "notificationPreference" ? old.ownerId === row.ownerId : model === "notificationSchedulerState" ? old.key === row.key : model === "discordLinkCode" ? old.code === row.code : old.id === row.id);
      if (duplicate) throw Object.assign(new Error("unique"), { code: "P2002" });
      tables[model].push(row); return clone(row);
    };
    const update = (row, data) => { for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : clone(value); };
    const decorate = (row, query) => row ? clone({ ...row, ...(query?.include?.task ? { task: tables.task.find((item) => item.id === row.taskId) } : {}), ...(query?.include?.notification ? { notification: tables.notificationLog.find((item) => item.id === row.notificationId) } : {}) }) : null;
    prisma[model] = {
      findMany: async (query) => rows(model, query).map((row) => decorate(row, query)),
      findFirst: async (query) => decorate(rows(model, query)[0], query),
      findUnique: async (query) => decorate(rows(model, query)[0], query),
      findUniqueOrThrow: async (query) => { const row = rows(model, query)[0]; if (!row) throw new Error(`Missing ${model}`); return decorate(row, query); },
      count: async (query) => rows(model, query).length,
      create: async ({ data }) => create(data),
      createMany: async ({ data, skipDuplicates }) => { let count = 0; for (const item of data) { try { create(item); count += 1; } catch (error) { if (!skipDuplicates) throw error; } } return { count }; },
      upsert: async ({ where, create: input, update: data }) => { const row = rows(model, { where })[0]; if (!row) return create(input); update(row, data); return clone(row); },
      update: async ({ where, data }) => { const row = rows(model, { where })[0]; if (!row) throw new Error("missing"); update(row, data); return clone(row); },
      updateMany: async ({ where, data }) => { const found = rows(model, { where }); found.forEach((row) => update(row, data)); return { count: found.length }; },
      deleteMany: async ({ where }) => { const before = tables[model].length; tables[model] = tables[model].filter((row) => !matches(row, where, model)); return { count: before - tables[model].length }; },
      groupBy: async (query) => { const unique = [...new Map(rows(model, { ...query, take: undefined }).map((row) => [row.plannedDate.toISOString(), { plannedDate: row.plannedDate }])).values()]; return unique.slice(0, query.take); },
    };
  }
  let queue = Promise.resolve();
  prisma.$transaction = async (operation) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    const previous = queue; let release; queue = new Promise((done) => { release = done; }); await previous;
    const snapshot = clone(tables);
    try { return await operation(prisma); } catch (error) { Object.assign(tables, snapshot); throw error; } finally { release(); }
  };
  prisma.$queryRaw = async (strings, ...values) => {
    if (!strings.join("").includes("DISTINCT owner_id")) return [];
    const [now, , cursor] = values;
    return [...new Set(tables.notificationDelivery.filter((row) => row.channel === "discord" && (["pending", "retry"].includes(row.status) && row.nextAttemptAt <= now || row.status === "sending" && row.leaseUntil <= now) && (!cursor || row.ownerId > cursor)).map((row) => row.ownerId))].sort().slice(0, values.at(-1)).map((ownerId) => ({ ownerId }));
  };
  const mocks = {
    "@/lib/prisma": { prisma },
    "@/lib/auth/require-user": { requireUser: async () => { if (options.unauthenticated) throw new Error("unauthorized"); return { id: A }; } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: options.unauthenticated ? null : { id: A } }, error: null }) } }) },
    "@/features/calendar/data": { loadCalendarEvents: async (ownerId, from, to) => ({ events: events.filter((event) => event.ownerId === ownerId && new Date(event.endsAt) > from && new Date(event.startsAt) < to), truncated: false }) },
    "@/features/discord/config": { discordBotToken: () => options.noToken ? "" : "offline-token", timingSafeEqualStrings: (a, b) => a === b },
    "@/features/discord/rest": { sendDiscordMessage: async (channelId, content) => { sent.push({ channelId, content }); return options.send ? options.send(channelId, content) : { ok: true }; } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  };
  const load = loader(mocks);
  const task = (ownerId = A, input = {}) => ({ id: ownerId === A ? T : U, ownerId, title: "Report", status: "TODO", dueAt: new Date(Date.now() + 3_600_000), ...input });
  const link = (ownerId = A) => tables.discordConnection.push({ ownerId, discordUserId: ownerId, dmChannelId: ownerId });
  return { load, prisma, tables, calls, sent, events, task, link, defaults };
}

test("date-only deadline remains open until next local midnight in all supported zones", () => {
  const h = harness(), policy = h.load("@/features/notifications/policy");
  for (const [zone, offset] of [["UTC", 0], ["Asia/Jakarta", 7], ["Asia/Makassar", 8], ["Asia/Jayapura", 9]]) {
    const task = h.task(A, { dueAt: new Date("2026-10-25T00:00:00Z") });
    const end = new Date(Date.parse("2026-10-26T00:00:00Z") - offset * 3_600_000);
    const soon = policy.taskCandidates(task, h.defaults, new Date(end.getTime() - 1), zone);
    assert.equal(soon[0].kind, "deadline_soon"); assert.match(soon[0].message, /2026-10-25 \(end of day\)/);
    assert.equal(policy.taskCandidates(task, h.defaults, end, zone)[0].kind, "task_overdue");
    assert.equal(soon[0].scheduledAt.toISOString(), new Date(Date.parse("2026-10-24T07:00:00Z") - offset * 3_600_000).toISOString());
  }
});

test("date math handles leap days, month/year rollover and exact legacy times", () => {
  const h = harness(), p = h.load("@/features/notifications/policy");
  assert.equal(p.dayAfter("2024-02-28"), "2024-02-29"); assert.equal(p.dayAfter("2026-12-31"), "2027-01-01");
  const task = h.task(A, { dueAt: new Date("2026-10-26T05:30:00Z") });
  assert.equal(p.taskCandidates(task, h.defaults, new Date("2026-10-25T05:29:59Z"), "Asia/Jakarta").length, 0);
  assert.equal(p.taskCandidates(task, h.defaults, new Date("2026-10-25T05:30:00Z"), "Asia/Jakarta")[0].kind, "deadline_soon");
  for (const status of ["DONE", "CANCELLED"]) assert.deepEqual(p.taskCandidates({ ...task, status }, h.defaults, NOW, "UTC"), []);
});

test("event occurrences have distinct stable keys, exact lead boundary, and hashed long Google IDs", () => {
  const h = harness(), p = h.load("@/features/notifications/policy");
  const event = { id: "series:2026-10-25", title: "Meeting", startsAt: "2026-10-25T01:15:00Z", timezone: "Asia/Jakarta", isAllDay: false };
  assert.equal(p.eventCandidate(event, h.defaults, new Date(NOW.getTime() - 1), "UTC"), null);
  const first = p.eventCandidate(event, h.defaults, NOW, "UTC"); assert.ok(first);
  assert.equal(p.eventCandidate(event, h.defaults, new Date(event.startsAt), "UTC"), null);
  const next = p.eventCandidate({ ...event, id: "series:2026-10-26", startsAt: "2026-10-26T01:15:00Z" }, h.defaults, new Date("2026-10-26T01:00:00Z"), "UTC");
  assert.notEqual(first.refKey, next.refKey);
  const google = p.eventCandidate({ ...event, id: `google:${"x".repeat(600)}`, kind: "google" }, h.defaults, NOW, "UTC");
  assert.ok(google.refKey.length <= 120); assert.equal(google.refKey, p.stableRef(`event:google:${"x".repeat(600)}:${Date.parse(event.startsAt)}`));
});

test("task/planner wall-clock conversion supports dates beyond the calendar editor range", () => {
  const h = harness(), p = h.load("@/features/notifications/policy");
  assert.equal(p.atHour("2115-01-01", 7, "Asia/Jakarta").toISOString(), "2115-01-01T00:00:00.000Z");
  assert.deepEqual(p.taskCandidates(h.task(A, { dueAt: new Date("2115-01-01T00:00:00Z") }), h.defaults, NOW, "Asia/Jakarta"), []);
  assert.equal(p.taskCandidates(h.task(A, { dueAt: new Date("1899-12-31T00:00:00Z") }), h.defaults, NOW, "UTC")[0].kind, "task_overdue");
});

test("all-day Google dates use calendar midnight, not shifted UTC midnight", () => {
  const h = harness(), p = h.load("@/features/notifications/policy");
  const event = { id: "google:all-day", kind: "google", title: "Holiday", startsAt: "2026-10-26T00:00:00Z", timezone: "Asia/Jakarta", isAllDay: true };
  const candidate = p.eventCandidate(event, h.defaults, new Date("2026-10-25T16:45:00Z"), "Asia/Jakarta");
  assert.equal(candidate.expiresAt.toISOString(), "2026-10-25T17:00:00.000Z");
  const utc = p.eventCandidate(event, h.defaults, new Date("2026-10-25T23:45:00Z"), "UTC");
  assert.equal(utc.expiresAt.toISOString(), "2026-10-26T00:00:00.000Z");
});

test("real calendar expansion feeds distinct recurring occurrences, omitting cancelled and replacing moved instances", async () => {
  const row = { id: T, ownerId: A, title: "Daily standup", description: null, location: null, taskId: null, startsAt: new Date("2026-10-25T01:15:00Z"), endsAt: new Date("2026-10-25T02:15:00Z"), timezone: "UTC", isAllDay: false, recurrenceRule: JSON.stringify({ frequency: "daily", weekdays: [], count: 3 }), exceptions: [] };
  row.exceptions.push({ ...row, id: U, originalStart: new Date("2026-10-26T01:15:00Z"), startsAt: new Date("2026-10-26T01:15:00Z"), endsAt: new Date("2026-10-26T02:15:00Z"), isCancelled: true });
  row.exceptions.push({ ...row, id: randomUUID(), originalStart: new Date("2026-10-27T01:15:00Z"), startsAt: new Date("2026-10-27T03:00:00Z"), endsAt: new Date("2026-10-27T04:00:00Z"), isCancelled: false });
  const calendar = loader({
    "@/lib/prisma": { prisma: { calendarEvent: { findMany: async ({ where, include }) => { assert.equal(where.ownerId, A); assert.equal(include.exceptions.where.ownerId, A); return [row]; } }, googleEventMirror: { findMany: async () => [] } } },
    "@/features/profile/data": {},
  })("@/features/calendar/data");
  const expanded = await calendar.loadCalendarEvents(A, new Date("2026-10-25T00:00:00Z"), new Date("2026-10-28T00:00:00Z"));
  assert.equal(expanded.events.length, 2);
  const h = harness(), p = h.load("@/features/notifications/policy");
  assert.ok(p.eventCandidate(expanded.events[0], h.defaults, NOW, "UTC"));
  assert.ok(p.eventCandidate(expanded.events[1], h.defaults, new Date("2026-10-27T02:45:00Z"), "UTC"));
  assert.equal(p.eventCandidate(expanded.events[1], h.defaults, new Date("2026-10-27T01:00:00Z"), "UTC"), null);
});

test("concurrent reconciliation persists one notification and one channel delivery", async () => {
  const h = harness(); h.tables.task.push(h.task()); h.link();
  const service = h.load("@/features/notifications/service");
  await Promise.all([service.reconcileOwner(A, new Date()), service.reconcileOwner(A, new Date())]);
  assert.equal(h.tables.notificationLog.length, 1); assert.equal(h.tables.notificationDelivery.length, 1);
  assert.equal(h.tables.notificationLog[0].ownerId, A);
  assert.ok(h.tables.notificationLog[0].message.includes("Report"));
  const inbox = await h.load("@/features/notifications/data").getNotificationInbox(A);
  assert.equal(inbox.unread, 1); assert.equal(inbox.items[0].id, h.tables.notificationLog[0].id);
});

test("owner isolation, read/all-read/dismiss persistence, invalid and unauthenticated actions", async () => {
  const h = harness(); h.tables.task.push(h.task(), h.task(B)); h.link();
  const service = h.load("@/features/notifications/service"); await service.reconcileOwner(A, new Date()); await service.reconcileOwner(B, new Date());
  const [own, foreign] = h.tables.notificationLog;
  const actions = h.load("@/features/notifications/actions"), data = h.load("@/features/notifications/data");
  await actions.markNotificationRead(foreign.id); await actions.dismissNotification(foreign.id);
  assert.equal(foreign.readAt, null); assert.equal(foreign.dismissedAt, null);
  assert.equal((await data.getNotificationInbox(A, foreign.id)).items.length, 1);
  assert.equal((await actions.markNotificationRead("bad-id")).ok, false);
  await actions.markNotificationRead(own.id); const firstRead = own.readAt;
  await actions.markNotificationRead(own.id); assert.equal(own.readAt, firstRead);
  assert.equal((await data.getNotificationInbox(A)).unread, 0);
  own.readAt = null; await actions.markAllNotificationsRead(); assert.ok(own.readAt); assert.equal(foreign.readAt, null);
  await actions.dismissNotification(own.id); assert.equal((await data.getNotificationInbox(A)).items.length, 0);
  assert.equal(h.tables.notificationDelivery[0].status, "cancelled"); assert.equal(h.tables.notificationLog.length, 2);
  await assert.rejects(() => harness({ unauthenticated: true }).load("@/features/notifications/actions").markAllNotificationsRead(), /unauthorized/);
});

test("inbox pagination uses stable owner-scoped cursor and safe internal navigation", async () => {
  const h = harness(), now = new Date();
  for (let index = 0; index < 45; index += 1) await h.prisma.notificationLog.create({ data: { ownerId: A, kind: "deadline_soon", refKey: `${index}`, title: "Task", message: "Saved", inApp: true, createdAt: now, href: index ? "/tasks" : "//evil.test" } });
  const data = h.load("@/features/notifications/data"), first = await data.getNotificationInbox(A), second = await data.getNotificationInbox(A, first.nextCursor);
  assert.equal(first.items.length, 20); assert.equal(second.items.length, 20); assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 40);
  assert.equal(data.safeNotificationHref("//evil.test"), "/dashboard"); assert.equal(data.safeNotificationHref("/tasks?task=abc"), "/tasks?task=abc");
});

test("preferences are validated/persisted, disabling cancels queue and stops new records", async () => {
  const h = harness(); h.tables.task.push(h.task()); h.link();
  const service = h.load("@/features/notifications/service"), actions = h.load("@/features/notifications/actions");
  await service.reconcileOwner(A, new Date());
  assert.equal((await actions.saveNotificationPreferences({ ...h.defaults, ownerId: B })).ok, false);
  assert.equal((await actions.saveNotificationPreferences({ ...h.defaults, constructor: "forged" })).ok, false);
  assert.equal((await actions.saveNotificationPreferences({ ...h.defaults, eventLeadMinutes: 999 })).ok, false);
  assert.equal((await actions.saveNotificationPreferences({ ...h.defaults, deadlineEnabled: false })).ok, true);
  assert.equal(h.tables.notificationDelivery[0].status, "cancelled");
  h.tables.task.push(h.task(A, { id: randomUUID() })); await service.reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 1);
  const stored = await h.load("@/features/notifications/data").getNotificationPreferences(A); assert.equal(stored.preferences.deadlineEnabled, false); assert.ok(!("taskCursor" in stored.preferences));
});

test("disabled channels create no records; Discord-only notifications stay out of inbox", async () => {
  const h = harness(); h.tables.task.push(h.task()); h.link();
  await h.prisma.notificationPreference.create({ data: { ownerId: A, inAppEnabled: false, discordEnabled: false } });
  const service = h.load("@/features/notifications/service"); await service.reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 0);
  h.tables.notificationPreference[0].discordEnabled = true; await service.reconcileOwner(A, new Date());
  assert.equal(h.tables.notificationDelivery.length, 1); assert.equal((await h.load("@/features/notifications/data").getNotificationInbox(A)).items.length, 0);
});

test("preference changes during source collection prevent publishing the stale snapshot", async () => {
  const h = harness(); h.tables.task.push(h.task());
  await h.prisma.notificationPreference.create({ data: { ownerId: A } });
  const original = h.prisma.task.findMany;
  h.prisma.task.findMany = async (query) => { const rows = await original(query); h.tables.notificationPreference[0].deadlineLeadDays = 0; return rows; };
  await h.load("@/features/notifications/service").reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 0);
});

test("legacy logs and truncated Google markers are preserved without replay", async () => {
  const h = harness(); const task = h.task(); h.tables.task.push(task); h.link();
  await h.prisma.notificationLog.create({ data: { ownerId: A, kind: "deadline_soon", refKey: `deadline:${task.id}:${task.dueAt.toISOString()}`, legacyDiscordSent: true } });
  const start = new Date(Date.now() + 10 * 60_000), id = `google:${"x".repeat(600)}`;
  h.events.push({ id, ownerId: A, kind: "google", title: "Imported", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: "UTC", isAllDay: false });
  await h.prisma.notificationLog.create({ data: { ownerId: A, kind: "event_starting", refKey: `event:${id}:${start.getTime()}`.slice(0, 120), legacyDiscordSent: true } });
  await h.load("@/features/notifications/service").reconcileOwner(A, new Date());
  assert.equal(h.tables.notificationLog.length, 2); assert.equal(h.tables.notificationDelivery.length, 0);
});

test("planner detects meaningful changes, suppresses duplicate generation and morning digest", async () => {
  const h = harness(); h.tables.task.push(h.task());
  await h.prisma.notificationPreference.create({ data: { ownerId: A, deadlineEnabled: false, overdueEnabled: false } });
  h.tables.dailyPlanItem.push({ id: randomUUID(), ownerId: A, taskId: T, plannedDate: new Date("2026-10-25T00:00:00Z"), position: 0 });
  const service = h.load("@/features/notifications/service");
  // 06:00 WIB availability, then 08:00 WIB: don't repeat identical text.
  await service.reconcileOwner(A, new Date("2026-10-24T23:00:00Z"));
  // Test store uses wall-clock createdAt; align persisted time to the explicit test clock.
  h.tables.notificationLog.forEach((row) => { row.createdAt = new Date("2026-10-24T23:00:00Z"); });
  await service.reconcileOwner(A, NOW); assert.equal(h.tables.notificationLog.length, 1);
  h.tables.task.push(h.task(A, { id: U })); h.tables.dailyPlanItem.push({ id: randomUUID(), ownerId: A, taskId: U, plannedDate: new Date("2026-10-25T00:00:00Z"), position: 1 });
  await service.reconcileOwner(A, NOW); await service.reconcileOwner(A, NOW);
  assert.equal(h.tables.notificationLog.length, 2); assert.notEqual(h.tables.notificationLog[0].sourceVersion, h.tables.notificationLog[1].sourceVersion);
});

test("overdue repeat is daily or once per deadline version, never every tick", () => {
  const h = harness(), p = h.load("@/features/notifications/policy"), task = h.task(A, { dueAt: new Date("2026-10-20T00:00:00Z") });
  const one = p.taskCandidates(task, h.defaults, NOW, "Asia/Jakarta")[0];
  assert.equal(one.refKey, p.taskCandidates(task, h.defaults, new Date(NOW.getTime() + 60_000), "Asia/Jakarta")[0].refKey);
  assert.notEqual(one.refKey, p.taskCandidates(task, h.defaults, new Date(NOW.getTime() + 86_400_000), "Asia/Jakarta")[0].refKey);
  const prefs = { ...h.defaults, overdueRepeatDays: 0 };
  assert.equal(p.taskCandidates(task, prefs, NOW, "UTC")[0].refKey, p.taskCandidates(task, prefs, new Date(NOW.getTime() + 86_400_000), "UTC")[0].refKey);
});

test("legacy planner logs establish a silent baseline; yesterday's known plan can get a morning summary", async () => {
  const h = harness(); h.tables.task.push(h.task());
  await h.prisma.notificationPreference.create({ data: { ownerId: A, deadlineEnabled: false, overdueEnabled: false } });
  h.tables.dailyPlanItem.push({ id: randomUUID(), ownerId: A, taskId: T, plannedDate: new Date("2026-10-25T00:00:00Z"), position: 0 });
  await h.prisma.notificationLog.create({ data: { ownerId: A, kind: "daily_plan", refKey: "plan:2026-10-25", legacyDiscordSent: true, sourceVersion: null, createdAt: NOW } });
  await h.load("@/features/notifications/service").reconcileOwner(A, NOW);
  assert.equal(h.tables.notificationLog.length, 1); assert.ok(h.tables.notificationLog[0].sourceVersion); assert.equal(h.tables.notificationDelivery.length, 0);
  h.tables.notificationLog.length = 0;
  const fingerprint = h.load("@/features/notifications/policy").planFingerprint("2026-10-25", h.tables.dailyPlanItem);
  await h.prisma.notificationLog.create({ data: { ownerId: A, kind: "plan_ready", refKey: "yesterday", sourceType: "planner", sourceId: "2026-10-25", sourceVersion: fingerprint, createdAt: new Date("2026-10-24T01:00:00Z") } });
  await h.load("@/features/notifications/service").reconcileOwner(A, NOW); assert.equal(h.tables.notificationLog.length, 2); assert.equal(h.tables.notificationLog[1].kind, "daily_plan");
});

async function seedDelivery(h, ownerId = A) { h.tables.task.push(h.task(ownerId)); h.link(ownerId); await h.load("@/features/notifications/service").reconcileOwner(ownerId, new Date()); return h.tables.notificationDelivery.at(-1); }

test("atomic delivery claims permit one send under concurrent workers", async () => {
  const h = harness(); await seedDelivery(h); const scheduler = h.load("@/features/notifications/scheduler");
  const results = await Promise.all([scheduler.deliverOne(A), scheduler.deliverOne(A), scheduler.deliverOne(A)]);
  assert.equal(results.filter((result) => result === "sent").length, 1); assert.equal(h.sent.length, 1); assert.equal(h.tables.notificationDelivery[0].attempts, 1);
  assert.equal(await scheduler.deliverOne(A), "empty");
});

test("transient/rate-limit failures persist backoff, bounded attempts and notification history", async () => {
  const h = harness({ send: () => ({ ok: false, error: "rate_limited", retryable: true, retryAfterMs: 90_000 }) });
  const delivery = await seedDelivery(h), scheduler = h.load("@/features/notifications/scheduler");
  await scheduler.deliverOne(A); assert.equal(delivery.status, "retry"); assert.ok(delivery.nextAttemptAt.getTime() >= Date.now() + 89_000);
  assert.equal(await scheduler.deliverOne(A), "empty");
  for (let index = 1; index < 5; index += 1) { delivery.nextAttemptAt = new Date(0); await scheduler.deliverOne(A); }
  assert.equal(delivery.attempts, 5); assert.equal(delivery.status, "failed"); assert.equal(h.sent.length, 5); assert.equal(h.tables.notificationLog.length, 1);
});

test("permanent Discord failure is terminal without deleting in-app history", async () => {
  const h = harness({ send: () => ({ ok: false, error: "discord_request_failed", retryable: false }) }); const delivery = await seedDelivery(h);
  await h.load("@/features/notifications/scheduler").deliverOne(A); assert.equal(delivery.status, "failed"); assert.equal(delivery.attempts, 1); assert.equal(h.tables.notificationLog.length, 1);
});

test("expired claim recovers, but a stale worker cannot acknowledge another claim", async () => {
  let unblock, entered;
  const gate = new Promise((done) => { unblock = done; }); const sending = new Promise((done) => { entered = done; });
  const h = harness({ send: async () => { entered(); await gate; return { ok: true }; } });
  const delivery = await seedDelivery(h); delivery.status = "sending"; delivery.claimToken = randomUUID(); delivery.leaseUntil = new Date(0); delivery.attempts = 1;
  const running = h.load("@/features/notifications/scheduler").deliverOne(A); await sending;
  const replacement = randomUUID(); delivery.claimToken = replacement; unblock(); await running;
  assert.equal(delivery.status, "sending"); assert.equal(delivery.claimToken, replacement); assert.equal(delivery.attempts, 2);
});

test("fresh connection recheck cancels a claim if relinking happens during validation", async () => {
  const h = harness(); const delivery = await seedDelivery(h);
  const original = h.prisma.discordConnection.findUnique; let reads = 0;
  h.prisma.discordConnection.findUnique = async (query) => { const connection = await original(query); reads += 1; return reads > 1 ? { ...connection, discordUserId: "replacement", dmChannelId: "changed" } : connection; };
  await h.load("@/features/notifications/scheduler").deliverOne(A); assert.equal(h.sent.length, 0); assert.equal(delivery.status, "cancelled");
});

test("delivery revalidates cancellation, completed tasks, owner, preferences and expired reminders", async () => {
  for (const change of [
    (h) => { h.tables.task[0].status = "DONE"; },
    (h) => { h.tables.task[0].status = "CANCELLED"; },
    (h) => { h.tables.task[0].ownerId = B; },
    (h) => { h.tables.notificationPreference[0].deadlineEnabled = false; },
    (h) => { h.tables.notificationLog[0].expiresAt = new Date(0); },
    (h) => { h.tables.discordConnection.length = 0; },
  ]) {
    const h = harness(); const delivery = await seedDelivery(h); change(h);
    await h.load("@/features/notifications/scheduler").deliverOne(A); assert.equal(h.sent.length, 0); assert.equal(delivery.status, "cancelled");
  }
  const start = new Date(Date.now() + 10 * 60_000), h = harness({ events: [{ id: "recurring-occurrence", ownerId: A, title: "Meeting", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 60_000).toISOString(), timezone: "UTC", isAllDay: false }] }); h.link();
  await h.load("@/features/notifications/service").reconcileOwner(A, new Date()); h.events.length = 0;
  await h.load("@/features/notifications/scheduler").deliverOne(A); assert.equal(h.sent.length, 0); assert.equal(h.tables.notificationDelivery[0].status, "cancelled");
});

test("task traversal advances past 100 delivered tasks and wraps without starvation", async () => {
  const h = harness({ noToken: true });
  for (let index = 0; index < 130; index += 1) h.tables.task.push(h.task(A, { id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}` }));
  const service = h.load("@/features/notifications/service");
  await service.reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 100);
  await service.reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 130); assert.equal(h.tables.notificationPreference[0].taskCursor, null);
  await service.reconcileOwner(A, new Date()); assert.equal(h.tables.notificationLog.length, 130);
});

test("scheduler serializes concurrent ticks, limits delivery, and rotates through users", async () => {
  const h = harness(); h.tables.profile.length = 0;
  for (let index = 1; index <= 31; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    h.tables.profile.push({ id, timezone: "UTC" }); h.tables.task.push(h.task(id, { id: randomUUID() })); h.link(id);
  }
  const scheduler = h.load("@/features/notifications/scheduler");
  const results = await Promise.all([scheduler.runNotificationTick(), scheduler.runNotificationTick()]);
  assert.equal(results.filter((result) => result.busy).length, 1); assert.equal(results.find((result) => !result.busy).processedOwners, 25); assert.ok(h.sent.length <= 20);
  for (let tick = 0; tick < 3; tick += 1) { const result = await scheduler.runNotificationTick(); assert.ok(result.sent <= 20); }
  assert.equal(new Set(h.sent.map((item) => item.channelId)).size, 31);
});

test("in-app scheduler works without Discord token, retaining queue without attempts", async () => {
  const h = harness({ noToken: true }); h.tables.task.push(h.task()); h.link();
  const result = await h.load("@/features/notifications/scheduler").runNotificationTick();
  assert.equal(result.created, 1); assert.equal(result.sent, 0); assert.equal(h.tables.notificationDelivery[0].attempts, 0);
});

test("one owner's collection error does not starve other owners or block existing deliveries", async () => {
  const h = harness(); await seedDelivery(h); h.tables.task.push(h.task(B));
  const find = h.prisma.task.findMany;
  h.prisma.task.findMany = async (query) => { if (query.where.ownerId === A) throw new Error("temporary read failure"); return find(query); };
  const result = await h.load("@/features/notifications/scheduler").runNotificationTick();
  assert.equal(result.errors, 1); assert.equal(result.processedOwners, 2); assert.equal(result.sent, 1); assert.ok(h.tables.notificationLog.some((row) => row.ownerId === B));
});

test("Discord relinking replaces only the code owner's link; foreign account cannot be taken over", async () => {
  const h = harness(); h.link(); h.link(B);
  const link = h.load("@/features/discord/link"), code = await link.createDiscordLinkCode(A);
  const conflict = await link.connectByCode({ discordUserId: B, discordUsername: "Foreign", dmChannelId: "dm", code: code.code });
  assert.equal(conflict.ok, false); assert.equal(h.tables.discordConnection.find((item) => item.ownerId === B).discordUserId, B); assert.equal(h.tables.discordLinkCode.length, 1);
  const result = await link.connectByCode({ discordUserId: "replacement", discordUsername: "Mine", dmChannelId: "new-dm", code: code.code });
  assert.equal(result.ok, true); assert.equal(h.tables.discordConnection.length, 2); assert.equal(h.tables.discordConnection.find((item) => item.ownerId === A).discordUserId, "replacement");
  assert.equal((await link.connectByCode({ discordUserId: "replacement", discordUsername: "Mine", dmChannelId: "new-dm", code: code.code })).ok, false);
});

test("a unique relink race rolls back code consumption and preserves the original link", async () => {
  const h = harness(); h.link(); const link = h.load("@/features/discord/link"), code = await link.createDiscordLinkCode(A);
  h.prisma.discordConnection.upsert = async () => { throw Object.assign(new Error("race"), { code: "P2002" }); };
  const result = await link.connectByCode({ discordUserId: "new", discordUsername: "Mine", dmChannelId: "dm", code: code.code });
  assert.equal(result.ok, false); assert.equal(h.tables.discordLinkCode[0].code, code.code); assert.equal(h.tables.discordConnection[0].discordUserId, A);
});

test("scheduler endpoint authenticates before DB access; inbox rejects anonymous/cross-owner input", async () => {
  const h = harness(); const route = h.load("@/app/api/notifications/tick/route");
  const previous = process.env.NOTIFICATIONS_SCHEDULER_SECRET; process.env.NOTIFICATIONS_SCHEDULER_SECRET = "offline-secret";
  try {
    assert.equal((await route.POST(new Request("http://test/api/notifications/tick", { method: "POST" }))).status, 401); assert.equal(h.calls.length, 0);
    const response = await route.POST(new Request("http://test/api/notifications/tick", { method: "POST", headers: { authorization: "Bearer offline-secret" } })); assert.equal(response.status, 200);
  } finally { if (previous === undefined) delete process.env.NOTIFICATIONS_SCHEDULER_SECRET; else process.env.NOTIFICATIONS_SCHEDULER_SECRET = previous; }
  const anonymous = harness({ unauthenticated: true }); assert.equal((await anonymous.load("@/app/api/notifications/route").GET(new Request("http://test/api/notifications"))).status, 401); assert.equal(anonymous.calls.length, 0);
  h.tables.task.push(h.task(), h.task(B)); await h.load("@/features/notifications/service").reconcileOwner(A, new Date()); await h.load("@/features/notifications/service").reconcileOwner(B, new Date());
  const response = await h.load("@/app/api/notifications/route").GET(new Request(`http://test/api/notifications?ownerId=${B}`));
  assert.equal((await response.json()).items.length, 1); assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("missing notification schema reports setup state, unrelated DB failure surfaces", async () => {
  const h = harness(), data = h.load("@/features/notifications/data");
  h.prisma.notificationPreference.findUnique = async () => { throw { code: "P2021", meta: { modelName: "NotificationPreference", table: "public.notification_preferences" } }; };
  assert.equal((await data.getNotificationPreferences(A)).schemaPending, true);
  h.prisma.notificationLog.findMany = async () => { throw { code: "P2022", meta: { modelName: "NotificationLog", column: "title" } }; };
  assert.equal((await data.getNotificationInbox(A)).schemaPending, true);
  h.prisma.notificationSchedulerState.upsert = async () => { throw { code: "P2021", meta: { table: "notification_scheduler_state" } }; };
  assert.equal((await h.load("@/features/notifications/scheduler").runNotificationTick()).schemaPending, true);
  h.prisma.notificationPreference.findUnique = async () => { throw { code: "P2021", meta: { table: "tasks" } }; };
  await assert.rejects(() => data.getNotificationPreferences(A));
});

test("UI renders real item semantics, escaped content, accessible settings and migration state", () => {
  const h = harness(), { NotificationItem } = h.load("@/features/notifications/components/notification-item"), { NotificationSettings } = h.load("@/features/notifications/components/notification-settings");
  const html = renderToStaticMarkup(React.createElement(NotificationItem, { item: { id: T, title: "<script>unsafe</script>", message: "long".repeat(500), href: "/tasks", kind: "deadline_soon", createdAt: NOW.toISOString(), readAt: null }, busy: false, onRead() {}, onDismiss() {}, onNavigate() {} }));
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("Unread")); assert.ok(html.includes("Mark read")); assert.ok(html.includes("[overflow-wrap:anywhere]"));
  const settings = renderToStaticMarkup(React.createElement(NotificationSettings, { initial: h.defaults, schemaPending: true, timezone: "Asia/Jakarta" }));
  assert.ok(settings.includes("fieldset disabled")); assert.ok(settings.includes("Save preferences")); assert.ok(settings.includes("awaiting database setup"));
  const bell = readFileSync(path.join(root, "features/notifications/components/notification-bell.tsx"), "utf8");
  assert.ok(bell.includes("calc(100vw-1.5rem)")); assert.ok(bell.includes("100dvh")); assert.ok(bell.includes("visibilityState")); assert.ok(bell.includes("Popover.Close"));
});

test("migration is additive, preserves logs, restricts privileges and enforces delivery owner FK", () => {
  const sql = readFileSync(path.join(root, "prisma/migrations/20261026_notification_system/migration.sql"), "utf8");
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM)\b/i);
  assert.match(sql, /legacy_discord_sent BOOLEAN NOT NULL DEFAULT true/); assert.match(sql, /legacy_discord_sent SET DEFAULT false/);
  assert.match(sql, /FOREIGN KEY \(notification_id, owner_id\) REFERENCES public.notification_logs\(id, owner_id\) ON DELETE CASCADE/);
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, 4); assert.match(sql, /FROM PUBLIC, anon, authenticated/);
});
