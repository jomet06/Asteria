/* Offline checks for dashboard aggregation: no network or live database required. */
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
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
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
const dt = createLoader()(path.join(root, "features/calendar/date-time.ts"), {});
const TODAY = dt.formatCalendarLocal(new Date(), "Asia/Jakarta").slice(0, 10);
const DAY_START = new Date(`${TODAY}T00:00:00+07:00`);

function fixture(overrides = {}) {
  const task = (extra = {}) => ({
    id: crypto.randomUUID(),
    title: "Task",
    status: "TODO",
    priority: "MEDIUM",
    dueAt: null,
    project: null,
    ...extra,
  });
  const rows = {
    dueToday: task({ id: "due", dueAt: new Date(DAY_START.getTime() + 2 * 3600_000) }),
    planned: task({ id: "plan", status: "TODO" }),
    plannedDone: task({ id: "plandone", status: "DONE" }),
    both: task({ id: "both", dueAt: new Date(DAY_START.getTime() + 3 * 3600_000) }),
    upcoming: task({ id: "up", dueAt: new Date(DAY_START.getTime() + 3 * 86400_000), priority: "HIGH" }),
    overdue: task({ id: "over", status: "IN_PROGRESS", dueAt: new Date(DAY_START.getTime() - 86400_000) }),
    done: task({ id: "done", status: "DONE", dueAt: new Date(DAY_START.getTime() + 3600_000) }),
  };
  return { rows, ...overrides };
}

function buildPrisma({ rows, plannedDate = TODAY } = {}) {
  function matchTask(row, where) {
    if (where.status && !where.status.in.includes(row.status)) return false;
    const d = where.dueAt;
    if (d) {
      const t = row.dueAt ? row.dueAt.getTime() : null;
      if (d.gte != null && (t == null || t < d.gte.getTime())) return false;
      if (d.lt != null && (t == null || t >= d.lt.getTime())) return false;
      if (d.lte != null && (t == null || t > d.lte.getTime())) return false;
    }
    return true;
  }
  const all = Object.values(rows);
  return {
    task: {
      findMany: async ({ where }) => all.filter((row) => matchTask(row, where)),
    },
    dailyPlanItem: {
      findMany: async () => {
        if (plannedDate !== TODAY) return [];
        return [
          { task: rows.planned },
          { task: rows.plannedDone },
          { task: rows.both },
        ];
      },
    },
  };
}

function buildMocks({ rows, calendarEvents = [], truncated = false } = {}) {
  const prisma = buildPrisma({ rows });
  return {
    "@/features/profile/data": {
      getMyAccount: async () => ({ user: { id: OWNER }, profile: { timezone: "Asia/Jakarta" } }),
    },
    "@/lib/prisma": { prisma },
    "@/features/calendar/data": {
      loadCalendarEvents: async () => ({ events: calendarEvents, truncated, schemaPending: false }),
    },
  };
}

const dataModule = (mocks) => createLoader()(path.join(root, "features/dashboard/data.ts"), mocks);

test("aggregates schedule, today's tasks, plan, deadlines, and reminders", async () => {
  const { rows } = fixture();
  const overview = await dataModule(buildMocks({ rows }))["getMyDashboardOverview"]();

  assert.equal(overview.timezone, "Asia/Jakarta");
  assert.equal(overview.today, TODAY);
  assert.deepEqual(
    overview.todaysTasks.map((task) => task.id).sort(),
    ["both", "due", "plan", "plandone"].sort()
  );
  assert.deepEqual(overview.planTasks.map((task) => task.id), ["plan", "plandone", "both"]);
  assert.deepEqual(overview.upcomingDeadlines.map((task) => task.id), ["up"]);
  assert.deepEqual(overview.reminders.map((task) => task.id), ["over"]);
  assert.equal(overview.truncated, false);
});

test("merges due-today and planned tasks without duplicates", async () => {
  const { rows } = fixture();
  const overview = await dataModule(buildMocks({ rows }))["getMyDashboardOverview"]();

  const both = overview.todaysTasks.filter((task) => task.id === "both");
  assert.equal(both.length, 1);
  assert.equal(both[0].planned, true);
  assert.equal(both[0].done, false);
});

test("completed tasks appear only when planned", async () => {
  const { rows } = fixture();
  const overview = await dataModule(buildMocks({ rows }))["getMyDashboardOverview"]();

  assert.ok(!overview.todaysTasks.some((task) => task.id === "done"));
  const plannedDone = overview.planTasks.find((task) => task.id === "plandone");
  assert.equal(plannedDone.done, true);
});

test("ongoing and next ignore all-day events and pick the following timed event", async () => {
  const { rows } = fixture();
  const events = [
    { id: "allday", title: "Holiday", kind: "event", startsAt: `${DAY_START.toISOString()}`, endsAt: new Date(DAY_START.getTime() + 86400_000).toISOString(), isAllDay: true },
    { id: "timed", title: "Later today", kind: "event", startsAt: new Date(Date.now() + 3600_000).toISOString(), endsAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isAllDay: false },
  ];
  const overview = await dataModule(buildMocks({ rows, calendarEvents: events }))["getMyDashboardOverview"]();

  assert.equal(overview.ongoing, null);
  assert.equal(overview.next.id, "timed");
  assert.equal(overview.events.length, 2);
});
