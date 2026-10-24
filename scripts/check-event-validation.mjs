/* Offline checks for calendar event validation: all-day + recurrence interplay. */
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

function load(file) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const entry = { exports: {} };
  function require(name) {
    if (name.startsWith(".")) {
      const base = path.resolve(path.dirname(file), name);
      for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return load(base + ext);
    }
    return nativeRequire(name);
  }
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(require, entry, entry.exports);
  return entry.exports;
}

const { readEventFields } = load(path.join(root, "features/calendar/validation.ts"));

function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    title: "Camp",
    description: "",
    location: "",
    timezone: "Asia/Jakarta",
    isAllDay: "true",
    startDate: "2026-10-24",
    endDate: "2026-10-25",
    recurrenceRule: "",
    ...extra,
  })) data.set(key, String(value));
  return data;
}

test("recurring all-day events may omit the end date and default to one-day instances", () => {
  const parsed = readEventFields(form({ endDate: "", recurrenceRule: '{"frequency":"daily","weekdays":[]}' }));
  assert.ok(parsed, "recurring all-day without endDate must parse");
  const days = (parsed.endsAt.getTime() - parsed.startsAt.getTime()) / 86_400_000;
  assert.equal(days, 1);
  assert.equal(parsed.isAllDay, true);
});

test("non-recurring all-day events still require an end date", () => {
  assert.equal(readEventFields(form({ endDate: "" })), null);
});

test("recurring all-day events honor an explicit multi-day end date", () => {
  const parsed = readEventFields(form({ endDate: "2026-10-27", recurrenceRule: '{"frequency":"weekly","weekdays":[6]}' }));
  assert.ok(parsed);
  // Inclusive end: Oct 24-27 spans four days.
  assert.equal((parsed.endsAt.getTime() - parsed.startsAt.getTime()) / 86_400_000, 4);
});

test("occurrence edits of recurring series still require an end date", () => {
  assert.equal(
    readEventFields(form({ endDate: "", recurrenceRule: "" })),
    null
  );
});

test("all-day range validation is unchanged otherwise", () => {
  assert.equal(readEventFields(form({ endDate: "2026-10-20" })), null, "end before start must fail");
  assert.equal(readEventFields(form({ startDate: "not-a-day" })), null, "bad start must fail");
});
