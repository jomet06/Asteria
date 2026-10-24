/* Offline checks for Asteria recurrence JSON → RFC 5545 RRULE conversion. */
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

const recurrence = load(path.join(root, "features/calendar/recurrence.ts"));

// Friday Oct 24 00:00 WIB — anchor weekday is Saturday (6).
const timed = { startsAt: new Date("2026-10-23T17:00:00.000Z"), timezone: "Asia/Jakarta", isAllDay: false };

test("daily and monthly series map without BYDAY", () => {
  assert.equal(recurrence.toRecurrenceRule('{"frequency":"daily","weekdays":[]}', timed), "RRULE:FREQ=DAILY");
  assert.equal(recurrence.toRecurrenceRule('{"frequency":"monthly","weekdays":[]}', timed), "RRULE:FREQ=MONTHLY");
});

test("weekly BYDAY includes the anchor weekday alongside the selection", () => {
  assert.equal(
    recurrence.toRecurrenceRule('{"frequency":"weekly","weekdays":[1,3]}', timed),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,SA"
  );
  // Anchor already selected is not duplicated.
  assert.equal(
    recurrence.toRecurrenceRule('{"frequency":"weekly","weekdays":[6]}', timed),
    "RRULE:FREQ=WEEKLY;BYDAY=SA"
  );
});

test("until maps to the inclusive local end of day, count maps verbatim", () => {
  assert.equal(
    recurrence.toRecurrenceRule('{"frequency":"daily","weekdays":[],"until":"2026-11-30"}', timed),
    "RRULE:FREQ=DAILY;UNTIL=20261130T165900Z"
  );
  assert.equal(
    recurrence.toRecurrenceRule('{"frequency":"daily","weekdays":[],"count":10}', timed),
    "RRULE:FREQ=DAILY;COUNT=10"
  );
});

test("all-day series use the RFC date form for until", () => {
  assert.equal(
    recurrence.toRecurrenceRule('{"frequency":"weekly","weekdays":[1],"until":"2026-11-30"}', {
      ...timed,
      isAllDay: true,
    }),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,SA;UNTIL=20261130"
  );
});

test("non-recurring and malformed input do not produce RRULEs", () => {
  assert.equal(recurrence.toRecurrenceRule(null, timed), null);
  assert.equal(recurrence.toRecurrenceRule("", timed), null);
  assert.throws(() => recurrence.toRecurrenceRule('{"frequency":"yearly"}', timed));
});
