/*
 * M2.6 — regression tests without a live database.
 * Run: node --test scripts/check-productivity-regression.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const taskA = "33333333-3333-4333-8333-333333333333";
const taskB = "44444444-4444-4444-8444-444444444444";
const planA = "55555555-5555-4555-8555-555555555555";
const planB = "66666666-6666-4666-8666-666666666666";
const subtaskA = "77777777-7777-4777-8777-777777777777";
const subtaskB = "88888888-8888-4888-8888-888888888888";
const D1 = "2026-10-20";
const D2 = "2026-10-21";
const date = (day) => new Date(`${day}T00:00:00.000Z`);

function form(fields) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, String(value));
  result.set("responseMode", "inline");
  return result;
}

function createHarness(authenticated = true) {
  const calls = [];
  const refreshed = [];
  const tasks = [
    { id: taskA, ownerId: A, title: "My task", status: "TODO", priority: "HIGH" },
    { id: taskB, ownerId: B, title: "Foreign task", status: "TODO", priority: "LOW" },
  ];
  const plans = [
    { id: planA, ownerId: A, taskId: taskA, plannedDate: date(D1), position: 0 },
    { id: planB, ownerId: B, taskId: taskB, plannedDate: date(D1), position: 0 },
  ];
  const subtasks = [
    { id: subtaskA, taskId: taskA, title: "Mine", isCompleted: false, position: 0 },
    { id: subtaskB, taskId: taskB, title: "Private", isCompleted: false, position: 0 },
  ];
  const faults = { create: null, update: null };
  const equal = (a, b) => a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : a === b;
  const match = (row, where = {}) => Object.entries(where).every(([key, expected]) => {
    if (key === "task") {
      const parent = tasks.find((t) => t.id === row.taskId);
      return parent?.ownerId === expected.is.ownerId;
    }
    return equal(row[key], expected);
  });
  const record = (name) => { calls.push(name); };

  const prisma = {
    task: {
      async findFirst({ where }) {
        record("task.findFirst");
        return tasks.find((row) => match(row, where)) ?? null;
      },
    },
    subtask: {
      async aggregate({ where }) {
        record("subtask.aggregate");
        const positions = subtasks.filter((s) => match(s, where)).map((s) => s.position);
        return { _max: { position: positions.length ? Math.max(...positions) : null } };
      },
      async create({ data }) {
        record("subtask.create");
        const row = { id: "99999999-9999-4999-8999-999999999999", isCompleted: false, ...data };
        subtasks.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        record("subtask.updateMany");
        const found = subtasks.filter((s) => match(s, where));
        found.forEach((s) => Object.assign(s, data));
        return { count: found.length };
      },
      async deleteMany({ where }) {
        record("subtask.deleteMany");
        const found = subtasks.filter((s) => match(s, where));
        found.forEach((s) => subtasks.splice(subtasks.indexOf(s), 1));
        return { count: found.length };
      },
    },
    dailyPlanItem: {
      async findFirst({ where }) {
        record("plan.findFirst");
        return plans.find((row) => match(row, where)) ?? null;
      },
      async findMany({ where }) {
        record("plan.findMany");
        return plans.filter((row) => match(row, where)).map((p) => ({
          ...p,
          task: tasks.find((t) => t.id === p.taskId),
        }));
      },
      async aggregate({ where }) {
        record("plan.aggregate");
        const positions = plans.filter((p) => match(p, where)).map((p) => p.position);
        return { _max: { position: positions.length ? Math.max(...positions) : null } };
      },
      async create({ data }) {
        record("plan.create");
        if (faults.create) throw { code: faults.create };
        if (plans.some((p) => p.taskId === data.taskId && equal(p.plannedDate, data.plannedDate))) {
          throw { code: "P2002" };
        }
        const row = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ...data };
        plans.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        record("plan.updateMany");
        if (faults.update) throw { code: faults.update };
        const found = plans.filter((p) => match(p, where));
        for (const row of found) {
          if (plans.some((p) => p.id !== row.id && p.taskId === row.taskId && equal(p.plannedDate, data.plannedDate))) {
            throw { code: "P2002" };
          }
          Object.assign(row, data);
        }
        return { count: found.length };
      },
      async deleteMany({ where }) {
        record("plan.deleteMany");
        const found = plans.filter((p) => match(p, where));
        found.forEach((p) => plans.splice(plans.indexOf(p), 1));
        return { count: found.length };
      },
    },
  };

  const mocks = {
    "@/lib/prisma": { prisma },
    "@/features/profile/data": {
      async getMyAccount() {
        if (!authenticated) throw new Error("AUTH_REQUIRED");
        return { user: { id: A }, profile: { timezone: "Asia/Jakarta" } };
      },
    },
    "next/cache": { revalidatePath: (p) => refreshed.push(p) },
    "next/navigation": { useSearchParams: () => null },
    "lucide-react": {},
    "@/components/ui/button": { Button: () => null },
  };

  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const entry = { exports: {} };
    cache.set(file, entry);
    const source = readFileSync(file, "utf8");
    const compiled = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/")
          ? path.join(root, name.slice(2))
          : path.resolve(path.dirname(file), name);
        for (const ext of [".ts", ".tsx"]) {
          if (existsSync(base + ext)) return load(path.relative(root, base + ext));
        }
        throw new Error(`Cannot resolve ${name}`);
      }
      return nativeRequire(name);
    }
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(
      localRequire, entry, entry.exports
    );
    return entry.exports;
  }
  return { load, calls, refreshed, tasks, plans, subtasks, faults };
}

const plannerActions = "features/tasks/daily-planner/actions.ts";
const plannerData = "features/tasks/daily-planner/data.ts";
const subtaskActions = "features/tasks/subtasks/actions.ts";

test("calendar date validation rejects rollover and supports leap years", () => {
  const { parsePlannerDate, formatPlannerDate } = createHarness().load("features/tasks/daily-planner/date.ts");
  assert.equal(formatPlannerDate(parsePlannerDate("2028-02-29")), "2028-02-29");
  for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "", null, "20-10-2026"]) {
    assert.equal(parsePlannerDate(bad), null);
  }
});

test("search, status, priority and overdue filters combine correctly", () => {
  const { matchesTaskFilters, DEFAULT_TASK_FILTERS } = createHarness().load("features/tasks/components/task-filter-bar.tsx");
  const row = {
    id: taskA, title: "Write report", description: "Quarterly budget",
    status: "TODO", priority: "HIGH", dueAt: "2026-10-19T00:00:00.000Z", projectId: null,
  };
  const filters = { ...DEFAULT_TASK_FILTERS, query: "budget", status: "TODO", priority: "HIGH", due: "OVERDUE" };
  assert.equal(matchesTaskFilters(row, filters, D2), true);
  assert.equal(matchesTaskFilters(row, { ...filters, priority: "LOW" }, D2), false);
  assert.equal(matchesTaskFilters({ ...row, status: "DONE" }, filters, D2), false);
});

test("sorting orders priority, deadlines and title without mutating input", () => {
  const { sortWorkspaceTasks } = createHarness().load("features/tasks/task-sorting.ts");
  const rows = [
    { id: "low", title: "Zebra", priority: "LOW", dueAt: null },
    { id: "urgent", title: "Alpha", priority: "URGENT", dueAt: "2026-10-23T00:00:00.000Z" },
    { id: "high", title: "Beta", priority: "HIGH", dueAt: "2026-10-20T00:00:00.000Z" },
  ];
  const ids = (sort) => sortWorkspaceTasks(rows, sort).map((r) => r.id);
  assert.deepEqual(ids("PRIORITY"), ["urgent", "high", "low"]);
  assert.deepEqual(ids("DUE_SOON"), ["high", "urgent", "low"]);
  assert.deepEqual(ids("TITLE_AZ"), ["urgent", "high", "low"]);
  assert.deepEqual(rows.map((r) => r.id), ["low", "urgent", "high"]);
});

test("authentication is required before planner database access", async () => {
  const h = createHarness(false);
  const actions = h.load(plannerActions);
  const data = h.load(plannerData);
  await assert.rejects(actions.addTaskToDay(form({ taskId: taskA, plannedDate: D2 })), /AUTH_REQUIRED/);
  await assert.rejects(actions.removeTaskFromDay(form({ planItemId: planA })), /AUTH_REQUIRED/);
  await assert.rejects(actions.moveTaskToDay(form({ planItemId: planA, plannedDate: D2 })), /AUTH_REQUIRED/);
  await assert.rejects(data.getMyDailyPlan(D1), /AUTH_REQUIRED/);
  assert.equal(h.calls.length, 0);
});

test("planner reads include only the authenticated owner's data", async () => {
  const h = createHarness();
  const result = await h.load(plannerData).getMyDailyPlan(D1);
  assert.deepEqual(result.items.map((p) => p.id), [planA]);
  assert.equal(result.items[0].task.title, "My task");
});

test("a forged ownerId is ignored when planning an owned Task", async () => {
  const h = createHarness();
  const result = await h.load(plannerActions).addTaskToDay(
    form({ taskId: taskA, plannedDate: D2, ownerId: B })
  );
  assert.deepEqual(result, { ok: true, code: "added" });
  const created = h.plans.find((p) => equalDates(p.plannedDate, date(D2)));
  assert.equal(created.ownerId, A);
  assert.equal(created.taskId, taskA);
  assert.equal(h.tasks[0].status, "TODO");
  assert.ok(h.refreshed.includes("/tasks/planner"));
});

function equalDates(a, b) { return a.getTime() === b.getTime(); }

test("foreign Task, duplicate schedule, and invalid date are rejected", async () => {
  const h = createHarness();
  const { addTaskToDay } = h.load(plannerActions);
  assert.deepEqual(await addTaskToDay(form({ taskId: taskB, plannedDate: D2 })), { ok: false, code: "task_not_found" });
  assert.deepEqual(await addTaskToDay(form({ taskId: taskA, plannedDate: D1 })), { ok: false, code: "already_planned" });
  assert.deepEqual(await addTaskToDay(form({ taskId: taskA, plannedDate: "2026-02-30" })), { ok: false, code: "invalid_input" });
  assert.equal(h.plans.length, 2);
  assert.equal(h.calls.includes("plan.create"), false);
});

test("concurrent duplicate insertion reports conflict without leaking error", async () => {
  const h = createHarness();
  h.faults.create = "P2002";
  const response = await h.load(plannerActions).addTaskToDay(form({ taskId: taskA, plannedDate: D2 }));
  assert.deepEqual(response, { ok: false, code: "already_planned" });
});

test("foreign plan IDs cannot be moved or removed", async () => {
  const h = createHarness();
  const actions = h.load(plannerActions);
  assert.deepEqual(await actions.removeTaskFromDay(form({ planItemId: planB })), { ok: false, code: "plan_not_found" });
  assert.deepEqual(await actions.moveTaskToDay(form({ planItemId: planB, plannedDate: D2 })), { ok: false, code: "plan_not_found" });
  assert.equal(h.plans.length, 2);
  assert.ok(equalDates(h.plans[1].plannedDate, date(D1)));
});

test("remove deletes only the planned occurrence, not its parent Task", async () => {
  const h = createHarness();
  const result = await h.load(plannerActions).removeTaskFromDay(form({ planItemId: planA }));
  assert.deepEqual(result, { ok: true, code: "removed" });
  assert.equal(h.plans.some((p) => p.id === planA), false);
  assert.equal(h.tasks.some((t) => t.id === taskA), true);
});

test("move changes only the planned date, and duplicate destinations are rejected", async () => {
  const h = createHarness();
  const actions = h.load(plannerActions);
  assert.deepEqual(await actions.moveTaskToDay(form({ planItemId: planA, plannedDate: D2 })), { ok: true, code: "moved" });
  assert.ok(equalDates(h.plans[0].plannedDate, date(D2)));
  assert.equal(h.tasks[0].status, "TODO");
  h.plans.push({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ownerId: A, taskId: taskA, plannedDate: date(D1), position: 0 });
  assert.deepEqual(await actions.moveTaskToDay(form({ planItemId: planA, plannedDate: D1 })), { ok: false, code: "already_planned" });
});

test("subtask CRUD cannot use a foreign Task or Subtask", async () => {
  const h = createHarness();
  const actions = h.load(subtaskActions);
  const invalidCreate = await actions.createSubtask(form({ taskId: taskB, title: "Injected" }));
  assert.equal(invalidCreate.message, "subtask_not_found");
  for (const [name, extra] of [
    ["updateSubtask", { title: "Injected" }],
    ["toggleSubtask", { isCompleted: "true" }],
    ["deleteSubtask", {}],
  ]) {
    const result = await actions[name](form({ taskId: taskB, subtaskId: subtaskB, ...extra }));
    assert.equal(result.message, "subtask_not_found");
  }
  assert.equal(h.subtasks.find((s) => s.id === subtaskB).title, "Private");
  assert.equal(h.subtasks.find((s) => s.id === subtaskB).isCompleted, false);
  assert.equal(h.subtasks.length, 2);
});

test("subtasks cannot be modified with a forged parent Task ID", async () => {
  const h = createHarness();
  const actions = h.load(subtaskActions);
  assert.equal((await actions.deleteSubtask(form({ taskId: taskA, subtaskId: subtaskB }))).message, "subtask_not_found");
  assert.equal(h.subtasks.length, 2);
});
