import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nativeRequire = createRequire(import.meta.url);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const date = (value) => new Date(value);
const form = (extra = {}) => {
  const f = new FormData();
  for (const [key, value] of Object.entries({ title: "Focus", description: "", location: "", timezone: "Asia/Jakarta", isAllDay: "false", startLocal: "2026-10-21T09:00", endLocal: "2026-10-21T10:00", ...extra })) f.set(key, String(value));
  return f;
};
const row = (extra = {}) => ({ id: ID, ownerId: A, title: "Focus", description: null, location: null, timezone: "Asia/Jakarta", isAllDay: false, startsAt: date("2026-10-21T02:00:00Z"), endsAt: date("2026-10-21T03:00:00Z"), recurrenceRule: null, taskId: null, parentId: null, originalStart: null, isCancelled: false, ...extra });
function harness(auth = true) {
  const rows = [row(), row({ id: FOREIGN, ownerId: B })];
  const tasks = [{ id: TASK, ownerId: A, title: "Study", status: "TODO", dueAt: date("2026-10-21T04:00Z"), description: "Read" }, { id: FOREIGN, ownerId: B, title: "Private", status: "TODO", dueAt: date("2026-10-21T04:00Z") }];
  const plans = [{ id: "plan", ownerId: A, taskId: TASK, task: tasks[0], plannedDate: date("2026-10-21T00:00Z"), position: 0 }];
  const calls = [];
  const faults = { read: null };
  function matches(r, w = {}) {
    return Object.entries(w).every(([key, value]) => {
      if (key === "OR") return value.some((part) => matches(r, part));
      if (key === "exceptions") return rows.some((child) => child.parentId === r.id && matches(child, value.some));
      if (value && typeof value === "object" && !(value instanceof Date)) {
        return Object.entries(value).every(([op, bound]) => op === "not" ? r[key] !== bound : op === "lt" ? r[key] < bound : op === "gt" ? r[key] > bound : op === "gte" ? r[key] >= bound : false);
      }
      return value instanceof Date ? r[key]?.getTime() === value.getTime() : r[key] === value;
    });
  }
  const prisma = {
    calendarEvent: {
      async findFirst({ where }) { calls.push("read"); return rows.find((r) => matches(r, where)) ?? null; },
      async findMany({ where, include, take }) { if (include && faults.read) throw faults.read; calls.push("read"); return rows.filter((r) => matches(r, where)).slice(0, take).map((r) => ({ ...r, ...(include ? { exceptions: rows.filter((c) => c.parentId === r.id && matches(c, include.exceptions.where)).slice(0, include.exceptions.take) } : {}) })); },
      async count({ where }) { return rows.filter((r) => matches(r, where)).length; },
      async create({ data }) { calls.push("create"); const r = row({ ...data, id: "66666666-6666-4666-8666-666666666666" }); rows.push(r); return r; },
      async updateMany({ where, data }) { calls.push("update"); const found = rows.filter((r) => matches(r, where)); found.forEach((r) => Object.assign(r, data)); return { count: found.length }; },
      async deleteMany({ where }) { calls.push("delete"); const found = rows.filter((r) => matches(r, where)); found.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { count: found.length }; },
      async upsert({ where, create, update }) { calls.push("exception"); const w = where.parentId_originalStart; const found = rows.find((r) => matches(r, w)); if (found) Object.assign(found, update); else rows.push(row({ ...create, id: "77777777-7777-4777-8777-777777777777" })); },
    },
    task: {
      async findFirst({ where }) { calls.push("task"); return tasks.find((r) => matches(r, where)) ?? null; },
      async findMany({ where, take }) { calls.push("tasks"); return tasks.filter((r) => matches(r, where)).slice(0, take); },
    },
    dailyPlanItem: { async findMany({ where, take }) { return plans.filter((r) => matches(r, where)).slice(0, take); } },
    googleEventMirror: { async findMany() { if (faults.read) throw faults.read; calls.push("mirror"); return []; } },
    async $transaction(fn) { return fn(prisma); },
    async $queryRaw(strings, id, ownerId) { return rows.filter((r) => r.id === id && r.ownerId === ownerId).map(({ id }) => ({ id })); },
  };
  const mocks = { "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) }, "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }) }, "@/lib/prisma": { prisma }, "@/features/profile/data": { async getMyAccount() { if (!auth) throw new Error("AUTH_REQUIRED"); return { user: { id: A }, profile: { timezone: "Asia/Jakarta" } }; } }, "next/cache": { revalidatePath() {} } };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const entry = { exports: {} }; cache.set(file, entry);
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    function require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith(".") || name.startsWith("@/")) {
        const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
        for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return load(base + ext);
      }
      return nativeRequire(name);
    }
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(require, entry, entry.exports);
    return entry.exports;
  }
  return { load, rows, tasks, plans, calls, faults, actions: () => load("features/calendar/actions.ts"), data: () => load("features/calendar/data.ts") };
}
const pure = harness();
const dt = pure.load("features/calendar/date-time.ts");
const recurrence = pure.load("features/calendar/recurrence.ts");
const browser = pure.load("features/calendar/event-browser.ts");

const browserEvents = [
  { id: "a", title: "Study", description: "Chapter TWO", location: "Library", kind: "event", startsAt: "2026-10-02T02:00:00Z", endsAt: "2026-10-02T03:00:00Z", timezone: "Asia/Jakarta", isAllDay: false, recurrenceRule: null },
  { id: "b", title: "Conference", description: null, location: "Online", kind: "google", startsAt: "2026-10-03T00:00:00Z", endsAt: "2026-10-04T00:00:00Z", timezone: "UTC", isAllDay: true, recurrenceRule: null },
  { id: "c", title: "Deadline", description: null, location: null, kind: "deadline", startsAt: "2026-10-01T02:00:00Z", endsAt: "2026-10-01T02:01:00Z", timezone: "Asia/Jakarta", isAllDay: false, recurrenceRule: null },
];

test("monthly browser searches title, location and description without case or surrounding whitespace sensitivity", () => {
  for (const query of [" study ", "LIBRARY", "chapter two"]) {
    assert.deepEqual(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, query }).map((item) => item.id), ["a"]);
  }
});

test("monthly browser combines kind and schedule filters", () => {
  assert.deepEqual(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, kind: "google", timing: "all-day" }).map((item) => item.id), ["b"]);
  assert.equal(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, kind: "google", timing: "timed" }).length, 0);
  assert.deepEqual(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, timing: "timed" }).map((item) => item.id), ["c", "a"]);
});

test("monthly browser sorts chronologically or alphabetically without mutating source events", () => {
  const before = browserEvents.map((item) => item.id);
  for (const [sort, expected] of [["earliest", ["c", "a", "b"]], ["latest", ["b", "a", "c"]], ["title", ["b", "c", "a"]]]) {
    assert.deepEqual(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, sort }).map((item) => item.id), expected);
  }
  assert.deepEqual(browserEvents.map((item) => item.id), before);
});

test("monthly browser supports legacy personal events, no matches and an empty month", () => {
  assert.equal(browser.filterMonthEvents([{ ...browserEvents[0], kind: undefined }], { ...browser.DEFAULT_EVENT_FILTERS, kind: "event" }).length, 1);
  assert.equal(browser.filterMonthEvents(browserEvents, { ...browser.DEFAULT_EVENT_FILTERS, query: "missing" }).length, 0);
  assert.deepEqual(browser.filterMonthEvents([], browser.DEFAULT_EVENT_FILTERS), []);
});

test("month boundaries use the profile timezone and exclusive event ends", () => {
  const events = [
    { ...browserEvents[0], id: "excluded-before", startsAt: "2026-09-30T16:00:00Z", endsAt: "2026-09-30T17:00:00Z" },
    { ...browserEvents[0], id: "overlap", startsAt: "2026-09-30T16:00:00Z", endsAt: "2026-09-30T18:00:00Z" },
    { ...browserEvents[0], id: "excluded-after", startsAt: "2026-10-31T17:00:00Z", endsAt: "2026-10-31T18:00:00Z" },
  ];
  assert.deepEqual(browser.eventsInMonth(events, "2026-10", "Asia/Jakarta").map((item) => item.id), ["overlap"]);
});

test("new event defaults use the selected date rather than the current month", () => {
  assert.deepEqual(browser.eventDefaults("2026-12-20", "Asia/Jakarta", date("2026-10-25T10:05:00Z")), { start: "2026-12-20T09:00", end: "2026-12-20T10:00" });
});

test("all-day month filtering uses calendar dates even when the viewer timezone differs", () => {
  const events = [
    { ...browserEvents[0], id: "november-only", isAllDay: true, startsAt: "2026-10-31T17:00:00Z", endsAt: "2026-11-01T17:00:00Z" },
    { ...browserEvents[0], id: "september-only", isAllDay: true, startsAt: "2026-09-29T17:00:00Z", endsAt: "2026-09-30T17:00:00Z" },
    { ...browserEvents[0], id: "october-first", isAllDay: true, startsAt: "2026-09-30T17:00:00Z", endsAt: "2026-10-01T17:00:00Z" },
  ];
  assert.deepEqual(browser.eventsInMonth(events, "2026-10", "UTC").map((item) => item.id), ["october-first"]);
});

test("today defaults round forward to the next half hour and preserve timezone across midnight", () => {
  assert.deepEqual(browser.eventDefaults("2026-10-25", "Asia/Jakarta", date("2026-10-25T10:05:00Z")), { start: "2026-10-25T17:30", end: "2026-10-25T18:30" });
  assert.deepEqual(browser.eventDefaults("2026-12-31", "Asia/Jakarta", date("2026-12-31T16:55:00Z")), { start: "2027-01-01T00:00", end: "2027-01-01T01:00" });
});

test("client form validation shares server rules and explains invalid title, range and repeat settings", () => {
  assert.equal(browser.eventFormError(form()), null);
  assert.match(browser.eventFormError(form({ title: " " })), /title/);
  assert.match(browser.eventFormError(form({ endLocal: "2026-10-21T09:00" })), /after the start/);
  assert.match(browser.eventFormError(form({ recurrenceRule: JSON.stringify({ frequency: "weekly", weekdays: [] }) })), /weekdays/);
  assert.match(browser.eventFormError(form({ recurrenceRule: JSON.stringify({ frequency: "daily", weekdays: [], until: "2026-10-20" }) })), /last occurrence/);
  const missingFlag = form(); missingFlag.delete("isAllDay");
  assert.ok(browser.eventFormError(missingFlag));
});

// Serialize the actual server-rendered successful controls, not a handwritten
// payload, so missing form fields cannot hide behind mocked action tests.
function renderedEventFields(h, item = null) {
  const { EventFields } = h.load("features/calendar/components/event-manager.tsx");
  const html = renderToStaticMarkup(React.createElement(EventFields, { item, timezone: "Asia/Jakarta", defaults: { start: "2026-11-02T09:00", end: "2026-11-02T10:00" }, occurrenceOnly: false }));
  const decode = (value) => value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
  const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
  const data = new FormData();
  for (const match of html.matchAll(/<input\b([^>]*)>/g)) {
    const input = attrs(match[1]);
    if (input.name && input.type !== "checkbox" && input.type !== "submit") data.append(input.name, input.value ?? "");
  }
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const select = attrs(match[1]);
    if (!select.name) continue;
    const options = [...match[2].matchAll(/<option\b([^>]*)>/g)].map((option) => attrs(option[1]));
    data.set(select.name, (options.find((option) => Object.hasOwn(option, "selected")) ?? options[0]).value);
  }
  for (const match of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const textarea = attrs(match[1]); if (textarea.name) data.set(textarea.name, decode(match[2]));
  }
  return { html, data };
}

test("actual new-event controls serialize a timed payload that the real create action accepts offline", async () => {
  const h = harness(); const { data } = renderedEventFields(h);
  assert.deepEqual(data.getAll("isAllDay"), ["false"]);
  data.set("title", "Form contract check");
  assert.equal(browser.eventFormError(data), null);
  assert.equal((await h.actions().createCalendarEvent(data)).ok, true);
  assert.equal(h.rows.at(-1).isAllDay, false);
  assert.equal(h.rows.at(-1).startsAt.toISOString(), "2026-11-02T02:00:00.000Z");
});

test("actual all-day controls submit the marker and preserve an inclusive end date", async () => {
  const h = harness();
  const { data } = renderedEventFields(h, { ...browserEvents[0], title: "All-day form check", isAllDay: true, startsAt: "2026-11-01T17:00:00Z", endsAt: "2026-11-03T17:00:00Z" });
  assert.deepEqual(data.getAll("isAllDay"), ["true"]);
  assert.equal(data.get("endDate"), "2026-11-03");
  assert.equal(browser.eventFormError(data), null);
  assert.equal((await h.actions().createCalendarEvent(data)).ok, true);
  assert.equal(h.rows.at(-1).endsAt.toISOString(), "2026-11-03T17:00:00.000Z");
});

test("actual recurring controls preserve their repeat termination and weekdays", () => {
  const h = harness();
  const { data } = renderedEventFields(h, { ...browserEvents[0], recurrenceRule: JSON.stringify({ frequency: "weekly", weekdays: [1, 3], count: 4 }) });
  assert.deepEqual(JSON.parse(data.get("recurrenceRule")), { frequency: "weekly", weekdays: [1, 3], count: 4 });
  assert.equal(browser.eventFormError(data), null);
});

test("separate 24-hour controls retain exact edited minutes and overnight payloads", async () => {
  const h = harness();
  const { data } = renderedEventFields(h, { ...browserEvents[0], title: "Night study", timezone: "UTC", isAllDay: false,
    startsAt: "2026-11-02T21:37:00Z", endsAt: "2026-11-03T00:07:00Z" });
  assert.equal(data.get("startLocal"), "2026-11-02T21:37");
  assert.equal(data.get("endLocal"), "2026-11-03T00:07");
  assert.equal(data.get("timezone"), "UTC");
  assert.equal(browser.eventFormError(data), null);
  assert.equal((await h.actions().createCalendarEvent(data)).ok, true);
  assert.equal(h.rows.at(-1).startsAt.toISOString(), "2026-11-02T21:37:00.000Z");
  assert.equal(h.rows.at(-1).endsAt.toISOString(), "2026-11-03T00:07:00.000Z");
});

test("event manager keeps the monthly list behind its button on initial render", () => {
  const h = harness(); const { EventManager } = h.load("features/calendar/components/event-manager.tsx");
  const html = renderToStaticMarkup(React.createElement(EventManager, { month: "2026-10", monthLabel: "October 2026", timezone: "Asia/Jakarta", events: browserEvents, limit: 500, truncated: false, schemaPending: false, view: "month", selectedDate: "2026-10-25", today: "2026-10-25", actions: {} }));
  assert.match(html, /Events this month/);
  assert.doesNotMatch(html, /aria-label="Calendar events"|aria-label="Edit event:/);
  assert.doesNotMatch(html, /role="dialog"/);
});
const rule = (frequency, extra = {}) => JSON.stringify({ frequency, weekdays: [1, 3], ...extra });
function expand(extra = {}, from = "2026-10-01T00:00Z", to = "2026-12-01T00:00Z") { return recurrence.expandSeries(row(extra), date(from), date(to)); }
for (const [zone, utc] of [["Asia/Jakarta", "02"], ["Asia/Makassar", "01"], ["Asia/Jayapura", "00"], ["UTC", "09"]]) test(`wall clock round trip ${zone}`, () => {
  const start = dt.parseCalendarLocal("2026-10-21T09:00", zone);
  assert.equal(start.toISOString(), `2026-10-21T${utc}:00:00.000Z`);
  assert.equal(dt.formatCalendarLocal(start, zone), "2026-10-21T09:00");
});
test("invalid dates, leap dates and year/month transitions", () => {
  for (const value of ["2026-02-29T00:00", "2026-13-01T09:00", "2026-10-21T24:00", "2026-10-21T09:60"]) assert.equal(dt.parseCalendarLocal(value, "UTC"), null);
  assert.ok(dt.parseCalendarLocal("2028-02-29T00:00", "UTC"));
  const range = dt.calendarMonthRange("2026-12", "Asia/Jakarta");
  assert.equal(range.nextMonth, "2027-01"); assert.equal(range.to.toISOString(), "2026-12-31T17:00:00.000Z");
});
test("all-day inclusive form produces exclusive cross-month end", () => {
  const r = dt.parseAllDayRange("2026-10-31", "2026-11-01", "Asia/Makassar");
  assert.equal(r.endsAt.toISOString(), "2026-11-01T16:00:00.000Z");
  assert.equal(dt.previousAllDayDate(r.endsAt, "Asia/Makassar"), "2026-11-01");
});
test("daily recurrence preserves local time and count", () => {
  const items = expand({ recurrenceRule: rule("daily", { count: 3 }) });
  assert.equal(items.length, 3); assert.equal(items[2].startsAt.toISOString(), "2026-10-23T02:00:00.000Z");
});
test("weekly weekday selection, inclusive until and DTSTART", () => {
  const items = expand({ recurrenceRule: rule("weekly", { until: "2026-11-02" }) });
  assert.deepEqual(items.map((r) => dt.formatCalendarLocal(r.startsAt, "Asia/Jakarta").slice(0, 10)), ["2026-10-21", "2026-10-26", "2026-10-28", "2026-11-02"]);
});
for (const day of [29, 30, 31]) test(`monthly ${day} skips absent dates`, () => {
  const items = expand({ startsAt: date(`2026-01-${day}T02:00Z`), endsAt: date(`2026-01-${day}T03:00Z`), recurrenceRule: rule("monthly", { count: 3 }) }, "2026-01-01T00:00Z", "2026-07-01T00:00Z");
  assert.equal(items.length, 3); assert.equal(items[1].startsAt.getUTCMonth(), 2);
});
test("bounded expansion of ancient never-ending series", () => {
  const items = expand({ startsAt: date("1900-01-01T02:00Z"), endsAt: date("1900-01-01T03:00Z"), recurrenceRule: rule("daily") }, "2100-12-01T00:00Z", "2101-01-01T00:00Z");
  assert.equal(items.length, 31);
  assert.throws(() => expand({}, "2020-01-01T00:00Z", "2026-01-01T00:00Z"), /range/);
});
test("recurrence rejects invalid frequency, weekdays, count, until and oversized input", () => {
  for (const input of [rule("yearly"), rule("weekly", { weekdays: [] }), rule("daily", { count: 0 }), rule("daily", { until: "2026-02-30" }), rule("daily", { count: 3, until: "2026-12-01" }), "x".repeat(1001)]) assert.throws(() => recurrence.parseRecurrence(input));
});
test("overlap excludes adjacent intervals and handles midnight", () => {
  const a = { startsAt: date("2026-10-31T23:00Z"), endsAt: date("2026-11-01T01:00Z") };
  assert.equal(recurrence.overlaps(a, { startsAt: a.endsAt, endsAt: date("2026-11-01T02:00Z") }), false);
  assert.equal(recurrence.overlaps(a, { startsAt: date("2026-11-01T00:00Z"), endsAt: date("2026-11-01T02:00Z") }), true);
});
test("valid create and conflict acknowledgment", async () => {
  const h = harness(); const a = h.actions();
  assert.equal((await a.createCalendarEvent(form())).code, "conflict");
  assert.equal((await a.createCalendarEvent(form({ confirmConflict: true }))).ok, true);
  assert.equal(h.rows.at(-1).ownerId, A);
});
for (const fields of [{ title: " " }, { title: "x".repeat(201) }, { endLocal: "2026-10-21T08:00" }, { timezone: "Mars" }, { ownerId: B }, { taskId: "invalid" }, { recurrenceRule: rule("daily", { until: "2026-10-20" }) }]) test(`reject invalid fields ${JSON.stringify(fields).slice(0, 70)}`, async () => {
  const h = harness(); assert.equal((await h.actions().createCalendarEvent(form(fields))).code, "invalid_input"); assert.equal(h.rows.length, 2);
});
test("unauthenticated reads and mutations fail before database access", async () => {
  const h = harness(false); const a = h.actions();
  for (const fn of [a.createCalendarEvent, a.updateCalendarEvent, a.deleteCalendarEvent]) await assert.rejects(fn(form({ eventId: ID })), /AUTH_REQUIRED/);
  await assert.rejects(h.data().getMyCalendarMonth("2026-10"), /AUTH_REQUIRED/); assert.equal(h.calls.length, 0);
});
test("foreign and invalid event IDs cannot update or delete", async () => {
  const h = harness(); const a = h.actions();
  for (const id of [FOREIGN, "bad", TASK]) for (const fn of [a.updateCalendarEvent, a.deleteCalendarEvent]) assert.equal((await fn(form({ eventId: id }))).ok, false);
  assert.equal(h.rows.length, 2);
});
test("owned series update excludes itself and deletion does not delete task", async () => {
  const h = harness(); const a = h.actions();
  assert.equal((await a.updateCalendarEvent(form({ eventId: ID, title: "Changed" }))).ok, true);
  assert.equal(h.rows[0].title, "Changed");
  assert.equal((await a.deleteCalendarEvent(form({ eventId: ID }))).ok, true); assert.equal(h.tasks.length, 2); assert.equal(h.rows.length, 1);
});
test("time block accepts owned task and rejects foreign task", async () => {
  const h = harness(); const a = h.actions();
  assert.equal((await a.createCalendarEvent(form({ taskId: FOREIGN, confirmConflict: true }))).code, "not_found");
  assert.equal((await a.createCalendarEvent(form({ taskId: TASK, confirmConflict: true }))).ok, true);
  assert.equal(h.rows.at(-1).taskId, TASK); assert.equal(h.tasks[0].status, "TODO");
});
test("single occurrence edit and delete leave series unchanged", async () => {
  const h = harness(); h.rows[0].recurrenceRule = rule("daily", { count: 4 }); const a = h.actions();
  const originalStart = "2026-10-22T02:00:00.000Z";
  assert.equal((await a.updateCalendarEvent(form({ eventId: ID, scope: "occurrence", originalStart, title: "Exception", startLocal: "2026-11-02T13:00", endLocal: "2026-11-02T14:00" }))).ok, true);
  assert.equal(h.rows[0].title, "Focus");
  let result = await h.data().loadCalendarEvents(A, date("2026-10-01"), date("2026-12-01"));
  assert.equal(result.events.length, 4); assert.equal(result.events.filter((e) => e.title === "Exception").length, 1);
  assert.equal((await a.deleteCalendarEvent(form({ eventId: ID, scope: "occurrence", originalStart }))).ok, true);
  result = await h.data().loadCalendarEvents(A, date("2026-10-01"), date("2026-12-01")); assert.equal(result.events.length, 3);
  assert.equal(h.rows[0].recurrenceRule, rule("daily", { count: 4 }));
});
test("forged occurrence dates and malformed scope are rejected", async () => {
  const h = harness(); h.rows[0].recurrenceRule = rule("monthly"); const a = h.actions();
  for (const extra of [{ scope: "occurrence", originalStart: "2026-10-22T02:00:00.000Z" }, { scope: "bad" }, { scope: "occurrence", originalStart: "junk" }, { scope: "occurrence", originalStart: "2026-02-30T02:00:00.000Z" }]) assert.equal((await a.deleteCalendarEvent(form({ eventId: ID, ...extra }))).code, "invalid_input");
});
test("entire series update resets exceptions explicitly", async () => {
  const h = harness(); h.rows[0].recurrenceRule = rule("daily");
  h.rows.push(row({ id: TASK, parentId: ID, originalStart: date("2026-10-22T02:00Z"), isCancelled: true }));
  assert.equal((await h.actions().updateCalendarEvent(form({ eventId: ID, recurrenceRule: rule("weekly"), confirmConflict: true }))).ok, true);
  assert.equal(h.rows.filter((r) => r.parentId === ID).length, 0);
});
test("conflict finds recurring instances whose original series is in the past", async () => {
  const h = harness(); h.rows[0].recurrenceRule = rule("daily");
  assert.equal((await h.actions().createCalendarEvent(form({ startLocal: "2026-10-23T09:30", endLocal: "2026-10-23T10:30" }))).code, "conflict");
});
test("adjacent events save without conflict confirmation", async () => {
  const h = harness(); assert.equal((await h.actions().createCalendarEvent(form({ startLocal: "2026-10-21T10:00", endLocal: "2026-10-21T11:00" }))).ok, true);
});
test("calendar projection includes only own events, task deadlines and planner entries", async () => {
  const h = harness(); const result = await h.data().getMyCalendarMonth("2026-10");
  assert.equal(result.events.length, 3);
  assert.deepEqual(result.events.map((e) => e.kind), ["event", "deadline", "planner"]);
  assert.equal(result.events[2].href, "/tasks/planner?date=2026-10-21");
  h.tasks[0].dueAt = date("2027-01-01T00:00Z");
  const refreshed = await h.data().getMyCalendarMonth("2026-10"); assert.equal(refreshed.events.some((e) => e.kind === "deadline"), false);
});
test("month grid includes sixth-week adjacent dates", async () => {
  const h = harness(); h.rows[0].startsAt = date("2026-03-08T02:00Z"); h.rows[0].endsAt = date("2026-03-08T03:00Z");
  const result = await h.data().getMyCalendarMonth("2026-02"); assert.equal(result.events.some((e) => e.seriesId === ID), true);
});
test("migration enforces composite ownership, exception identity and safe cascade", () => {
  const sql = readFileSync("prisma/migrations/20261022_calendar_completion/migration.sql", "utf8");
  assert.match(sql, /FOREIGN KEY \(task_id, owner_id\)[\s\S]*REFERENCES public.tasks\(id, owner_id\) ON DELETE CASCADE/);
  assert.match(sql, /FOREIGN KEY \(parent_id, owner_id\)[\s\S]*REFERENCES public.calendar_events\(id, owner_id\) ON DELETE CASCADE/);
  assert.match(sql, /UNIQUE \(parent_id, original_start\)/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("weekly count remains correct when expanding far after DTSTART", () => {
  assert.equal(expand({ recurrenceRule: rule("weekly", { count: 3 }) }, "2026-11-01T00:00Z", "2026-12-01T00:00Z").length, 0);
  const items = expand({ recurrenceRule: rule("weekly", { count: 5 }) }, "2026-11-01T00:00Z", "2026-12-01T00:00Z");
  assert.equal(items.length, 2);
});
test("recurring overnight events retain duration across month and year", () => {
  const items = expand({ startsAt: date("2026-12-30T16:00Z"), endsAt: date("2026-12-30T19:00Z"), recurrenceRule: rule("daily", { count: 3 }) }, "2026-12-30T00:00Z", "2027-01-03T00:00Z");
  assert.equal(items.length, 3);
  assert.equal(dt.formatCalendarLocal(items[1].startsAt, "Asia/Jakarta"), "2026-12-31T23:00");
  assert.equal(dt.formatCalendarLocal(items[1].endsAt, "Asia/Jakarta"), "2027-01-01T02:00");
});
test("cancelled deadlines are omitted while completed deadlines retain status", async () => {
  const h = harness(); h.tasks[0].status = "CANCELLED";
  assert.equal((await h.data().getMyCalendarMonth("2026-10")).events.some((e) => e.kind === "deadline"), false);
  h.tasks[0].status = "DONE";
  assert.match((await h.data().getMyCalendarMonth("2026-10")).events.find((e) => e.kind === "deadline").title, /DONE/);
});
test("moved occurrence remains visible beyond original series termination", async () => {
  const h = harness(); h.rows[0].recurrenceRule = rule("daily", { count: 2 });
  h.rows.push(row({ id: TASK, parentId: ID, originalStart: date("2026-10-22T02:00Z"), startsAt: date("2027-02-01T02:00Z"), endsAt: date("2027-02-01T03:00Z") }));
  const result = await h.data().loadCalendarEvents(A, date("2027-02-01"), date("2027-03-01")); assert.equal(result.events.length, 1); assert.equal(result.events[0].id, TASK);
});
for (const view of ["month", "week", "day"]) test(`render ${view} view with accessible navigation and scheduled cards`, async () => {
  const h = harness(); const { CalendarViews } = h.load("features/calendar/components/calendar-views.tsx");
  const result = await h.data().getMyCalendarMonth("2026-10");
  const html = renderToStaticMarkup(React.createElement(CalendarViews, { view, selectedDate: "2026-10-21", today: "2026-10-21", timezone: "Asia/Jakarta", events: result.events, truncated: false }));
  assert.match(html, /aria-label="Go to date"/); assert.match(html, /View event: Focus/); assert.match(html, /Deadline: Study/); assert.match(html, /Plan: Study/); assert.match(html, /aria-current="page"/);
  if (view !== "month") { assert.match(html, /23:00/); assert.match(html, /09:00/); }
});
test("overlapping timeline cards render separate lanes", async () => {
  const h = harness(); const { CalendarViews } = h.load("features/calendar/components/calendar-views.tsx");
  const base = (await h.data().getMyCalendarMonth("2026-10")).events.find((e) => e.kind === "event");
  const html = renderToStaticMarkup(React.createElement(CalendarViews, { view: "day", selectedDate: "2026-10-21", today: "2026-10-21", timezone: "Asia/Jakarta", events: [base, { ...base, id: "overlap", title: "Other" }], truncated: false }));
  assert.match(html, /width:calc\(50% - 4px\)/); assert.match(html, /View event: Other/);
});

test("pending completion schema still loads owned calendar events and productivity projections", async () => {
  const h = harness();
  h.faults.read = { code: "P2022", meta: { driverAdapterError: { cause: { column: "calendar_events.task_id" } } } };
  const result = await h.data().getMyCalendarMonth("2026-10");
  assert.equal(result.schemaPending, true);
  assert.equal(result.events.length, 3);
  assert.equal(result.events.filter((e) => e.kind === "event").length, 1);
  assert.equal(result.events[0].seriesId, ID);
});
test("calendar compatibility fallback never hides unrelated database errors", async () => {
  for (const error of [{ code: "P1001" }, { code: "P2022", meta: { column: "calendar_events.title" } }]) {
    const h = harness(); h.faults.read = error;
    await assert.rejects(h.data().getMyCalendarMonth("2026-10"), (actual) => actual === error);
  }
});
