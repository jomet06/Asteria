import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync("lib/prisma.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(seed = {}) {
  const fields = { id: "id", parentId: "parentId" };
  let created = 0;
  class Client { constructor() { this.instance = ++created; } }
  const context = vm.createContext({
    ...seed,
    process: { env: { DATABASE_URL: "postgresql://test.invalid/test", NODE_ENV: "development" } },
    require(name) {
      if (name === "@prisma/adapter-pg") return { PrismaPg: class {} };
      if (name === "@/generated/prisma/client") return { PrismaClient: Client, Prisma: { CalendarEventScalarFieldEnum: fields } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    fields,
    load() {
      context.entry = { exports: {} };
      vm.runInContext(`(function(require,exports){${compiled}\n})(require,entry.exports)`, context);
      return context.entry.exports.prisma;
    },
  };
}

test("replaces a legacy unversioned Prisma singleton after regeneration", () => {
  const stale = { instance: "old" };
  assert.notEqual(harness({ prisma: stale }).load(), stale);
});

test("reuses the current Prisma singleton across hot reloads", () => {
  const h = harness();
  assert.equal(h.load(), h.load());
});

test("replaces the cached client when generated Calendar fields change", () => {
  const h = harness();
  const old = h.load();
  h.fields.taskId = "taskId";
  assert.notEqual(h.load(), old);
});
