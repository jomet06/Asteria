/* Offline checks for task planning fields: parsing, defaults, and dependency cycles. */
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

function load(file, mocks = {}) {
  file = path.resolve(file);
  const entry = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  function require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith(".")) {
      const base = path.resolve(path.dirname(file), name);
      for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return load(base + ext, mocks);
    }
    return nativeRequire(name);
  }
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(require, entry, entry.exports);
  return entry.exports;
}

const fields = load(path.join(root, "features/tasks/task-fields.ts"));

function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    title: "Write report",
    description: "",
    projectId: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    ...extra,
  })) data.set(key, String(value));
  return data;
}

test("quick-add forms get planning defaults", () => {
  const parsed = fields.readTaskFields(form());
  assert.equal(parsed.difficulty, "NORMAL");
  assert.equal(parsed.estimatedMinutes, null);
  assert.equal(parsed.progress, 0);
  assert.equal(parsed.dependsOnTaskId, null);
});

test("planning fields parse, clamp status, and reject invalid input", () => {
  const parsed = fields.readTaskFields(form({
    difficulty: "HARD",
    estimatedMinutes: "90",
    progress: "40",
    dependsOnTaskId: "11111111-1111-4111-8111-111111111111",
  }));
  assert.equal(parsed.difficulty, "HARD");
  assert.equal(parsed.estimatedMinutes, 90);
  assert.equal(parsed.progress, 40);
  assert.equal(parsed.dependsOnTaskId, "11111111-1111-4111-8111-111111111111");

  assert.equal(fields.readTaskFields(form({ estimatedMinutes: "" })).estimatedMinutes, null);
  assert.equal(fields.readTaskFields(form({ progress: "0" })).progress, 0);
  assert.equal(fields.readTaskFields(form({ status: "DONE", progress: "10" })).progress, 100);

  for (const extra of [
    { difficulty: "IMPOSSIBLE" },
    { estimatedMinutes: "0" },
    { estimatedMinutes: "1441" },
    { estimatedMinutes: "half" },
    { progress: "101" },
    { progress: "-5" },
    { dependsOnTaskId: "not-a-uuid" },
  ]) {
    assert.equal(fields.readTaskFields(form(extra)), null, JSON.stringify(extra));
  }

  // Empty dependency clears to null.
  assert.equal(fields.readTaskFields(form({ dependsOnTaskId: "" })).dependsOnTaskId, null);
});

test("dependency cycles are detected, including through long chains", async () => {
  // Existing chain C -> B -> A; making A depend on C closes the loop at A.
  const chain = { C: "B", B: "A" };
  assert.equal(
    await fields.dependencyChainHasCycle("A", "C", async (id) => chain[id] ?? null),
    true
  );
  assert.equal(
    await fields.dependencyChainHasCycle("D", "C", async (id) => chain[id] ?? null),
    false
  );
  assert.equal(
    await fields.dependencyChainHasCycle("A", "A", async () => null),
    true
  );

  // Chains longer than the planning depth cap are rejected too.
  let depth = 0;
  assert.equal(
    await fields.dependencyChainHasCycle("start", "deep", async () => (depth += 1) < 500 ? `t${depth}` : null),
    true
  );
});
