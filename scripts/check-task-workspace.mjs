/* Run: node --test scripts/check-task-workspace.mjs
 * Exercises the real actions/components with in-memory Prisma and Supabase doubles.
 * Never loads environment variables or connects to a database.
 */
import assert from "node:assert/strict";
import { readFileSync, accessSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const loadDependency = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const activeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const archivedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const taskId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const foreignTaskId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

class Redirect extends Error {
  constructor(url) { super(url); this.url = url; }
}

function harness({ authenticated = true } = {}) {
  const calls = [];
  const refreshed = [];
  const projects = [
    { id: activeId, ownerId: owner, name: "Active", description: null, isArchived: false },
    { id: archivedId, ownerId: owner, name: "Archived", description: null, isArchived: true },
    { id: foreignId, ownerId: other, name: "Private", description: null, isArchived: false },
  ];
  const tasks = [
    { id: taskId, ownerId: owner, projectId: archivedId, title: "Existing", description: null, status: "TODO", priority: "MEDIUM", dueAt: null },
    { id: foreignTaskId, ownerId: other, projectId: foreignId, title: "Private task" },
  ];
  const subtasks = [
    {
      id: "99999999-9999-4999-8999-999999999999",
      taskId,
      title: "Owned step",
      isCompleted: false,
      position: 0,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      taskId: foreignTaskId,
      title: "Private step",
      isCompleted: true,
      position: 0,
    },
  ];
  const matches = (row, where) => Object.entries(where ?? {}).every(([key, value]) => row[key] === value);
  function model(name, rows) {
    return Object.fromEntries(["findMany", "findFirst", "create", "updateMany", "deleteMany"].map((method) => [method, async (args) => {
      calls.push({ name, method, args });
      const found = rows.filter((row) => matches(row, args.where));
      
      if (method === "findMany") {
        return found.map((row) => {
          // Simulate Prisma Project query.
          if (name === "project") {
            return {
              ...row,
              _count: {
                tasks: tasks.filter(
                  (task) =>
                    task.projectId === row.id &&
                    matches(
                      task,
                      args.include?._count.select.tasks.where
                    )
                ).length,
              },
            };
          }

          // Simulate Prisma Task include: { subtasks: ... }.
          if (name === "task" && args.include?.subtasks) {
            const relatedSubtasks = subtasks
              .filter((subtask) => subtask.taskId === row.id)
              .sort(
                (a, b) =>
                  a.position - b.position ||
                  a.id.localeCompare(b.id)
              )
              .map(
                ({ id, title, isCompleted, position }) => ({
                  id,
                  title,
                  isCompleted,
                  position,
                })
              );

            return {
              ...row,
              subtasks: relatedSubtasks,
            };
          }

          return { ...row };
        });
      }

      if (method === "findFirst") return found[0] ? { ...found[0] } : null;
      if (method === "create") {
        const row = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", isArchived: false, ...args.data };
        rows.push(row);
        return { ...row };
      }
      if (method === "updateMany") found.forEach((row) => Object.assign(row, args.data));
      if (method === "deleteMany") found.forEach((row) => rows.splice(rows.indexOf(row), 1));
      // FK behavior is deliberately not simulated: retaining/unassigning tasks
      // must also be checked against PostgreSQL, not proven by a test double.
      return { count: found.length };
    }]));
  }
  const prisma = {
    task: model("task", tasks), project: model("project", projects),
    profile: { upsert: async ({ where, create }) => {
      assert.equal(where.id, owner);
      assert.equal(create.id, owner);
      return { id: owner };
    } },
  };
  const mocks = {
    "@/lib/prisma": { prisma },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({
      data: { user: authenticated ? { id: owner, user_metadata: {} } : null }, error: null,
    }) } }) },
    "@/app/auth/actions": { signOut: async () => {} },
    // AppShell is an async server component (it awaits the account read);
    // the workspace tests render synchronously, so pass the tree through.
    "@/components/app-shell": {
      AppShell: ({ children }) => React.createElement("div", null, children),
    },
    "next/cache": { revalidatePath: (url) => refreshed.push(url) },
    "next/server": { connection: async () => {} },
    "next/navigation": {
      redirect: (url) => { throw new Redirect(url); },
      // SSR uses the server-provided initialView. History navigation is checked
      // in the browser, where Next supplies a live search-parameter snapshot.
      useSearchParams: () => null,
      useRouter: () => ({ replace() {} }),
    },
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => {
      delete props.scroll;
      delete props.onClick;
      return React.createElement("a", { href, ...props }, children);
    } },
  };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const cachedModule = { exports: {} };
    cache.set(filename, cachedModule);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }, fileName: filename }).outputText;
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        for (const extension of [".ts", ".tsx"]) {
          try { accessSync(base + extension); } catch { continue; }
          return load(base + extension);
        }
        throw new Error(`Cannot resolve ${specifier}`);
      }
      return loadDependency(specifier);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, cachedModule, cachedModule.exports);
    return cachedModule.exports;
  }
  return { load, calls, refreshed, tasks, projects };
}

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Test", description: "", projectId: "", status: "TODO", priority: "MEDIUM", dueDate: "", view: archivedId, ...values })) data.set(key, value);
  return data;
}

async function redirects(action, data, expected) {
  await assert.rejects(action(data), (error) => error instanceof Redirect && error.url === expected);
}

test("All Tasks, Inbox, and project filtering include archived tasks correctly", () => {
  const h = harness();
  const { filterWorkspaceTasks, readWorkspaceView, workspaceHref } = h.load("features/tasks/workspace-view.ts");
  const rows = [{ projectId: null }, { projectId: activeId }, { projectId: archivedId }];
  assert.equal(filterWorkspaceTasks(rows, "all").length, 3);
  assert.deepEqual(filterWorkspaceTasks(rows, "inbox"), [rows[0]]);
  assert.deepEqual(filterWorkspaceTasks(rows, archivedId), [rows[2]]);
  for (const value of [undefined, [activeId], "//evil.test", "https://evil.test", "invalid"]) {
    assert.equal(readWorkspaceView(value), "all");
    assert.equal(workspaceHref(value), "/tasks");
  }
});

test("workspace reads and project task counts are owner scoped", async () => {
  const h = harness();
  const data = await h.load("features/tasks/data.ts").getMyTaskWorkspace();
  assert.equal(data.tasks.length, 1);
  assert.equal(data.projects.length, 2);
  for (const call of h.calls) assert.equal(call.args.where.ownerId, owner);
  const projectRead = h.calls.find((call) => call.name === "project");
  assert.equal(projectRead.args.include._count.select.tasks.where.ownerId, owner);
});

test("unauthenticated workspace reads and every action redirect before database access", async () => {
  const h = harness({ authenticated: false });
  await redirects(h.load("features/tasks/data.ts").getMyTaskWorkspace, undefined, "/login");
  for (const file of ["features/tasks/actions.ts", "features/tasks/projects/actions.ts"]) {
    for (const action of Object.values(h.load(file))) await redirects(action, form(), "/login");
  }
  assert.equal(h.calls.length, 0);
});

test("task creation accepts no project and ignores forged ownerId", async () => {
  const h = harness();
  await redirects(h.load("features/tasks/actions.ts").createTask, form({ ownerId: other, view: "inbox" }), "/tasks?view=inbox&status=created");
  assert.equal(h.tasks.at(-1).ownerId, owner);
  assert.equal(h.tasks.at(-1).projectId, null);
  assert.deepEqual(h.refreshed, ["/tasks", "/dashboard"]);
});

test("task creation accepts an owned active project", async () => {
  const h = harness();
  await redirects(h.load("features/tasks/actions.ts").createTask, form({ projectId: activeId }), `/tasks?view=${archivedId}&status=created`);
  assert.equal(h.tasks.at(-1).projectId, activeId);
});

for (const projectId of [archivedId, foreignId]) test(`task creation rejects archived/foreign project ${projectId}`, async () => {
  const h = harness();
  await redirects(h.load("features/tasks/actions.ts").createTask, form({ projectId }), `/tasks?view=${archivedId}&error=invalid_project`);
  assert.equal(h.tasks.length, 2);
});

test("editing retains an existing archived assignment, or clears/moves it to an active project", async () => {
  for (const projectId of [archivedId, "", activeId]) {
    const h = harness();
    await redirects(h.load("features/tasks/actions.ts").updateTask, form({ taskId, projectId, title: "Edited" }), `/tasks?view=${archivedId}&status=updated`);
    assert.equal(h.tasks[0].title, "Edited");
    assert.equal(h.tasks[0].projectId, projectId || null);
  }
});

test("editing rejects moving a task into an archived or foreign project", async () => {
  for (const projectId of [archivedId, foreignId]) {
    const h = harness();
    h.tasks[0].projectId = activeId;
    await redirects(h.load("features/tasks/actions.ts").updateTask, form({ taskId, projectId }), `/tasks?view=${archivedId}&error=invalid_project`);
    assert.equal(h.tasks[0].projectId, activeId);
  }
});

for (const name of ["updateTask", "toggleTaskStatus", "deleteTask"]) test(`${name} rejects another user's task`, async () => {
  const h = harness();
  const original = JSON.stringify(h.tasks);
  await redirects(h.load("features/tasks/actions.ts")[name], form({ taskId: foreignTaskId, nextStatus: "DONE" }), `/tasks?view=${archivedId}&error=not_found`);
  assert.equal(JSON.stringify(h.tasks), original);
  for (const call of h.calls) assert.equal(call.args.where.ownerId, owner);
});

test("complete, reopen, and delete work for an owned task", async () => {
  const h = harness();
  const actions = h.load("features/tasks/actions.ts");
  for (const nextStatus of ["DONE", "TODO"]) {
    await redirects(actions.toggleTaskStatus, form({ taskId, nextStatus }), `/tasks?view=${archivedId}&status=updated`);
    assert.equal(h.tasks[0].status, nextStatus);
  }
  await redirects(actions.deleteTask, form({ taskId }), `/tasks?view=${archivedId}&status=deleted`);
  assert.deepEqual(h.tasks.map((row) => row.id), [foreignTaskId]);
});

test("all task statuses and priorities remain supported", async () => {
  const h = harness();
  const action = h.load("features/tasks/actions.ts").createTask;
  for (const status of ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]) {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
      await redirects(action, form({ status, priority }), `/tasks?view=${archivedId}&status=created`);
      assert.equal(h.tasks.at(-1).status, status);
      assert.equal(h.tasks.at(-1).priority, priority);
    }
  }
});

test("invalid fields, IDs, dates, statuses and priorities cannot mutate tasks", async () => {
  const h = harness();
  const actions = h.load("features/tasks/actions.ts");
  for (const values of [{ title: " " }, { title: "x".repeat(201) }, { description: "x".repeat(2001) }, { projectId: "bad" }, { dueDate: "2026-02-31" }, { dueDate: "no-date" }, { status: "BROKEN" }, { priority: "EXTREME" }]) {
    await redirects(actions.createTask, form(values), `/tasks?view=${archivedId}&error=invalid_input`);
  }
  await redirects(actions.deleteTask, form({ taskId: "bad" }), `/tasks?view=${archivedId}&error=invalid_input`);
  await redirects(actions.toggleTaskStatus, form({ taskId, nextStatus: "CANCELLED" }), `/tasks?view=${archivedId}&error=invalid_input`);
  assert.equal(h.calls.length, 0);
});

test("create, edit, archive, restore, and delete project actions use the workspace", async () => {
  const h = harness();
  const actions = h.load("features/tasks/projects/actions.ts");
  await redirects(actions.createProject, form({ name: "New", ownerId: other }), "/tasks?view=ffffffff-ffff-4fff-8fff-ffffffffffff&status=project_created");
  assert.equal(h.projects.at(-1).ownerId, owner);
  await redirects(actions.updateProject, form({ projectId: activeId, name: "Renamed" }), `/tasks?view=${archivedId}&status=project_updated`);
  assert.equal(h.projects[0].name, "Renamed");
  for (const archive of ["true", "false"]) {
    await redirects(actions.setProjectArchived, form({ projectId: activeId, archive }), `/tasks?view=${archivedId}&status=project_${archive === "true" ? "archived" : "restored"}`);
    assert.equal(h.projects[0].isArchived, archive === "true");
  }
  await redirects(actions.deleteProject, form({ projectId: activeId, view: activeId }), "/tasks?view=inbox&status=project_deleted");
  assert.equal(h.calls.some((call) => call.name === "task"), false);
});

for (const name of ["updateProject", "setProjectArchived", "deleteProject"]) test(`${name} rejects another user's project`, async () => {
  const h = harness();
  const original = JSON.stringify(h.projects);
  await redirects(h.load("features/tasks/projects/actions.ts")[name], form({ projectId: foreignId, name: "Forged", archive: "true" }), `/tasks?view=${archivedId}&error=project_not_found`);
  assert.equal(JSON.stringify(h.projects), original);
  assert.equal(h.calls[0].args.where.ownerId, owner);
});

test("invalid project inputs cannot mutate projects", async () => {
  const h = harness();
  const actions = h.load("features/tasks/projects/actions.ts");
  for (const values of [{ name: " " }, { name: "x".repeat(121) }, { name: "Valid", description: "x".repeat(1001) }]) {
    await redirects(actions.createProject, form(values), `/tasks?view=${archivedId}&error=project_invalid_input`);
  }
  await redirects(actions.setProjectArchived, form({ projectId: activeId, archive: "yes" }), `/tasks?view=${archivedId}&error=project_invalid_input`);
  assert.equal(h.calls.length, 0);
});

test("quick add defaults the project and task details retain only the current archived assignment", () => {
  const h = harness();
  const { QuickAddTask } = h.load("features/tasks/components/quick-add-task.tsx");
  const { TaskDetail } = h.load("features/tasks/task-form.tsx");
  const projects = h.projects.filter((project) => project.ownerId === owner);
  const shared = { projects, tasks: [], actions: {}, onResult: () => {}, view: activeId };
  const createMarkup = renderToStaticMarkup(React.createElement(QuickAddTask, shared));
  assert.match(createMarkup, new RegExp(`<option value="${activeId}" selected=""`));
  assert.doesNotMatch(createMarkup, new RegExp(archivedId));
  assert.match(createMarkup, /aria-label="Quick add task"/);
  assert.match(createMarkup, /<input(?=[^>]*name="title")(?=[^>]*required="")[^>]*>/);
  assert.match(createMarkup, /aria-expanded="false"/);
  assert.match(createMarkup, /hidden=""[^>]*><div[^>]*><label[^>]*>Project/);
  const editMarkup = renderToStaticMarkup(React.createElement(TaskDetail, { ...shared, task: h.tasks[0], onClose: () => {} }));
  assert.match(editMarkup, new RegExp(`<option value="${archivedId}" selected=""`));
  assert.match(editMarkup, /<option value="">Inbox<\/option>/);
  assert.match(editMarkup, /aria-label="Edit task"/);
  assert.match(editMarkup, /Save changes/);
  assert.match(editMarkup, /Delete task/);
  assert.doesNotMatch(editMarkup, /role="alertdialog"/);
});

test("legacy projects route redirects to the canonical tasks route", () => {
  const h = harness();
  assert.throws(() => h.load("app/projects/page.tsx").default(), (error) => error instanceof Redirect && error.url === "/tasks");
});

test("workspace page renders one navigation feature and only owned tasks/projects", async () => {
  const h = harness();
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({}) });
  function checkKeys(element) {
    if (!React.isValidElement(element)) return;
    const children = element.props.children;
    const items = Array.isArray(children) ? children : [children];
    const keys = items.filter(React.isValidElement).map((child) => child.key).filter((key) => key !== null);
    assert.equal(new Set(keys).size, keys.length, "Sibling keys must be unique");
    items.forEach(checkKeys);
  }
  checkKeys(page);
  const markup = renderToStaticMarkup(page);
  assert.match(markup, /To-Do List/);
  // Project browsing is deferred behind an accessible, initially closed picker.
  assert.match(markup, /aria-label="Browse projects"[^>]*aria-expanded="false"/);
  assert.match(markup, /id="workspace-search"/);
  assert.doesNotMatch(markup, /href="\/projects"/);
  assert.doesNotMatch(markup, /Private task|>Private</);
  assert.match(markup, /aria-label="Complete task: Existing"/);
  assert.match(markup, /aria-label="Open task: Existing"/);
  assert.doesNotMatch(markup, /aria-label="Edit task"/);
  assert.doesNotMatch(markup, /role="dialog"|role="alertdialog"/);
});

test("page defaults new tasks to a selected project and supports project management", async () => {
  const h = harness();
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({ view: activeId }) });
  const markup = renderToStaticMarkup(page);
  // Quick add now lives inside a dialog that stays closed during SSR; its
  // project default is covered by the dedicated QuickAddTask component test.
  assert.doesNotMatch(markup, /aria-label="Quick add task"/);
  assert.match(markup, /aria-label="Actions for Active"/);
  assert.match(markup, /aria-label="New project"/);
  assert.match(markup, /A fresh start for this project/);
  assert.doesNotMatch(markup, /name="name"|role="alertdialog"/);
  assert.doesNotMatch(markup, /Existing/);
});

test("archived project page exposes its menu and existing tasks while hiding task creation", async () => {
  const h = harness();
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({ view: archivedId }) });
  const markup = renderToStaticMarkup(page);
  assert.match(markup, /aria-label="Actions for Archived"/);
  assert.match(markup, /Archived project\./);
  assert.match(markup, /Restore it from the project menu/);
  assert.match(markup, /aria-label="Open task: Existing"/);
  assert.match(markup, /aria-label="Complete task: Existing"/);
  // Archived views hide every task-creation affordance.
  assert.doesNotMatch(markup, />New task</);
});

test("page handles empty Inbox, no projects, and an inaccessible project without disclosure", async () => {
  for (const view of ["inbox", foreignId]) {
    const h = harness();
    h.projects.splice(0);
    const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({ view }) });
    const markup = renderToStaticMarkup(page);
    assert.match(markup, /No projects yet/);
    assert.match(markup, view === "inbox" ? /Your Inbox is empty/ : /Project not found or access denied/);
    assert.doesNotMatch(markup, /Private task|>Private</);
  }
});

test("workspace sends only task and project presentation fields to the client", async () => {
  const h = harness();
  h.tasks[0].dueAt = new Date("2026-10-17T00:00:00.000Z");
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({ view: activeId }) });
  const { tasks, projects, initialView } = page.props.children.props;
  assert.equal(initialView, activeId);
  assert.equal(tasks.length, 1);
  assert.equal(projects.length, 2);
  
  assert.deepEqual(
    Object.keys(tasks[0]).sort(),
    [
      "id",
      "title",
      "description",
      "projectId",
      "status",
      "priority",
      "dueAt",
      "difficulty",
      "estimatedMinutes",
      "progress",
      "dependsOnTaskId",
      "dependsOnTitle",
      "subtasks",
    ].sort()
  );

  assert.equal(tasks[0].subtasks.length, 1);

  assert.deepEqual(
    Object.keys(tasks[0].subtasks[0]).sort(),
    [
      "id",
      "title",
      "isCompleted",
      "position",
    ].sort()
  );

  assert.equal(
    tasks[0].subtasks[0].title,
    "Owned step"
  );

  // A foreign user's Subtask must not be exposed.
  assert.doesNotMatch(
    JSON.stringify({ tasks, projects }),
    /Private step/
  );

  assert.deepEqual(Object.keys(projects[0]).sort(), ["id", "name", "description", "isArchived"].sort());
  assert.equal(tasks[0].dueAt, "2026-10-17T00:00:00.000Z");
  assert.doesNotMatch(JSON.stringify({ tasks, projects }), new RegExp(`${owner}|${other}|ownerId|_count`));
});

test("completed tasks start collapsed and retain accessible reopen controls", async () => {
  const h = harness();
  h.tasks[0].status = "DONE";
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({}) });
  const markup = renderToStaticMarkup(page);
  assert.match(markup, /All caught up/);
  assert.match(markup, /aria-expanded="false"[^>]*>[\s\S]*?Completed &amp; cancelled/);
  assert.match(markup, /<div id="[^"]+" hidden=""><ul aria-label="Completed and cancelled tasks"/);
  assert.match(markup, /aria-label="Reopen task: Existing"/);
  assert.match(markup, /line-through/);
});

test("unauthenticated task page redirects to login", async () => {
  const h = harness({ authenticated: false });
  await assert.rejects(h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({}) }), (error) => error instanceof Redirect && error.url === "/login");
  assert.equal(h.calls.length, 0);
});

test("unexpected and repeated query parameters are handled safely", async () => {
  const h = harness();
  const page = await h.load("app/tasks/page.tsx").default({ searchParams: Promise.resolve({
    status: "constructor", error: "toString", view: [activeId, foreignId],
  }) });
  const markup = renderToStaticMarkup(page);
  assert.match(markup, /All Tasks/);
  assert.doesNotMatch(markup, /role="alert"/);
});

test("inline task mutations return feedback and revalidate without navigation", async () => {
  const h = harness();
  const actions = h.load("features/tasks/actions.ts");
  const submit = (values) => form({ responseMode: "inline", view: "inbox", ...values });

  assert.deepEqual(await actions.createTask(submit({ ownerId: other })), {
    kind: "status", message: "created", view: "inbox",
  });
  assert.equal(h.tasks.at(-1).ownerId, owner);
  assert.equal(h.tasks.at(-1).projectId, null);

  assert.deepEqual(await actions.updateTask(submit({ taskId, projectId: archivedId, title: "Edited inline" })), {
    kind: "status", message: "updated", view: "inbox",
  });
  assert.equal(h.tasks[0].title, "Edited inline");
  assert.equal(h.tasks[0].projectId, archivedId);

  for (const nextStatus of ["DONE", "TODO"]) {
    assert.deepEqual(await actions.toggleTaskStatus(submit({ taskId, nextStatus })), {
      kind: "status", message: "updated", view: "inbox",
    });
    assert.equal(h.tasks[0].status, nextStatus);
  }

  assert.deepEqual(await actions.deleteTask(submit({ taskId })), {
    kind: "status", message: "deleted", view: "inbox",
  });
  assert.equal(h.tasks.some((task) => task.id === taskId), false);
  assert.deepEqual(h.refreshed, Array.from({ length: 5 }, () => ["/tasks", "/dashboard"]).flat());
});

test("inline project mutations return their next workspace view without navigation", async () => {
  const h = harness();
  const actions = h.load("features/tasks/projects/actions.ts");
  const submit = (values) => form({ responseMode: "inline", view: activeId, ...values });

  assert.deepEqual(await actions.createProject(submit({ name: "New inline", ownerId: other })), {
    kind: "status", message: "project_created", view: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  });
  assert.equal(h.projects.at(-1).ownerId, owner);

  assert.deepEqual(await actions.updateProject(submit({ projectId: activeId, name: "Renamed inline" })), {
    kind: "status", message: "project_updated", view: activeId,
  });
  assert.equal(h.projects[0].name, "Renamed inline");

  for (const archive of ["true", "false"]) {
    assert.deepEqual(await actions.setProjectArchived(submit({ projectId: activeId, archive })), {
      kind: "status", message: archive === "true" ? "project_archived" : "project_restored", view: activeId,
    });
    assert.equal(h.projects[0].isArchived, archive === "true");
  }

  assert.deepEqual(await actions.deleteProject(submit({ projectId: activeId })), {
    kind: "status", message: "project_deleted", view: "inbox",
  });
  assert.equal(h.projects.some((project) => project.id === activeId), false);
  assert.equal(h.calls.some((call) => call.name === "task"), false);
  assert.deepEqual(h.refreshed, Array.from({ length: 5 }, () => ["/tasks", "/dashboard"]).flat());
});

test("inline invalid input exits every action before database access or revalidation", async () => {
  const h = harness();
  const cases = [
    ["features/tasks/actions.ts", "createTask", { title: " " }, "invalid_input"],
    ["features/tasks/actions.ts", "updateTask", { taskId }, "invalid_input"],
    ["features/tasks/actions.ts", "toggleTaskStatus", { taskId, nextStatus: "CANCELLED" }, "invalid_input"],
    ["features/tasks/actions.ts", "deleteTask", { taskId: "invalid" }, "invalid_input"],
    ["features/tasks/projects/actions.ts", "createProject", { name: " " }, "project_invalid_input"],
    ["features/tasks/projects/actions.ts", "updateProject", { projectId: activeId, name: " " }, "project_invalid_input"],
    ["features/tasks/projects/actions.ts", "setProjectArchived", { projectId: activeId, archive: "yes" }, "project_invalid_input"],
    ["features/tasks/projects/actions.ts", "deleteProject", { projectId: "invalid" }, "project_invalid_input"],
  ];
  for (const [file, action, values, message] of cases) {
    const data = form({ responseMode: "inline", view: "//untrusted.example", ...values });
    if (action === "updateTask") data.delete("title");
    assert.deepEqual(await h.load(file)[action](data), { kind: "error", message, view: "all" });
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.refreshed.length, 0);
});

test("inline mode cannot bypass task or project ownership", async () => {
  const h = harness();
  const original = JSON.stringify({ tasks: h.tasks, projects: h.projects });
  for (const [file, actions, values, message] of [
    ["features/tasks/actions.ts", ["updateTask", "toggleTaskStatus", "deleteTask"], { taskId: foreignTaskId, nextStatus: "DONE" }, "not_found"],
    ["features/tasks/projects/actions.ts", ["updateProject", "setProjectArchived", "deleteProject"], { projectId: foreignId, name: "Forged", archive: "true" }, "project_not_found"],
  ]) {
    for (const action of actions) {
      assert.deepEqual(await h.load(file)[action](form({ responseMode: "inline", ...values })), {
        kind: "error", message, view: archivedId,
      });
    }
  }
  assert.equal(JSON.stringify({ tasks: h.tasks, projects: h.projects }), original);
  assert.equal(h.refreshed.length, 0);
  for (const call of h.calls) assert.equal(call.args.where.ownerId, owner);
});

test("inline task assignment keeps archived and foreign project restrictions", async () => {
  const h = harness();
  const actions = h.load("features/tasks/actions.ts");
  for (const projectId of [archivedId, foreignId]) {
    assert.deepEqual(await actions.createTask(form({ responseMode: "inline", projectId })), {
      kind: "error", message: "invalid_project", view: archivedId,
    });
  }
  h.tasks[0].projectId = activeId;
  for (const projectId of [archivedId, foreignId]) {
    assert.deepEqual(await actions.updateTask(form({ responseMode: "inline", taskId, projectId })), {
      kind: "error", message: "invalid_project", view: archivedId,
    });
  }
  assert.equal(h.tasks.length, 2);
  assert.equal(h.tasks[0].projectId, activeId);
  assert.equal(h.refreshed.length, 0);
});

test("inline mode preserves authentication redirects for every action", async () => {
  const h = harness({ authenticated: false });
  for (const file of ["features/tasks/actions.ts", "features/tasks/projects/actions.ts"]) {
    for (const action of Object.values(h.load(file))) {
      await redirects(action, form({ responseMode: "inline" }), "/login");
    }
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.refreshed.length, 0);
});
