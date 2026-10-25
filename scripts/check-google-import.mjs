/* Offline regression tests. All Google, authentication and DB calls are mocked. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    const absolute = resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const entry = { exports: {} };
    cache.set(absolute, entry);
    const code = ts.transpileModule(readFileSync(absolute, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith(".")) return load(resolve(dirname(absolute), `${name}.ts`));
      return nativeRequire(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolute })(require, entry, entry.exports);
    return entry.exports;
  };
}

const folder = "features/calendar/google/";
const { normalizeGoogleEvent, readCalendarSelection } = loader()(`${folder}import-validation.ts`);
const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2026-12-01T00:00:00Z");
function event(overrides = {}) {
  return { id: "event-1", summary: "Study", status: "confirmed",
    start: { dateTime: "2026-10-25T09:00:00+07:00", timeZone: "Asia/Bangkok" },
    end: { dateTime: "2026-10-25T10:00:00+07:00" }, ...overrides };
}

test("selection accepts up to three distinct calendars, deduplicating repeated IDs", () => {
  assert.deepEqual(readCalendarSelection(["a", "a", "b", "c"], null), ["a", "b", "c"]);
});
test("selection rejects a fourth calendar instead of silently trimming it", () => {
  assert.throws(() => readCalendarSelection(["a", "b", "c", "d"], null), { code: "too_many_calendars" });
});
test("selection rejects empty, malformed and the Asteria push target", () => {
  for (const value of [[], [""], [" "], [new Blob(["x"])], ["a".repeat(513)]]) {
    assert.throws(() => readCalendarSelection(value, null));
  }
  assert.throws(() => readCalendarSelection(["target"], "target"), { code: "invalid_calendars" });
});
test("timed events preserve absolute time and original timezone", () => {
  const actual = normalizeGoogleEvent(event());
  assert.equal(actual.startsAt.toISOString(), "2026-10-25T02:00:00.000Z");
  assert.equal(actual.timezone, "Asia/Bangkok");
});
test("DST offsets determine instants without assuming Jakarta", () => {
  const actual = normalizeGoogleEvent(event({
    start: { dateTime: "2026-11-01T01:30:00-04:00", timeZone: "America/New_York" },
    end: { dateTime: "2026-11-01T01:30:00-05:00", timeZone: "America/New_York" },
  }));
  assert.equal(actual.endsAt - actual.startsAt, 3_600_000);
});
test("all-day dates retain the exclusive end without introducing a timezone offset", () => {
  const actual = normalizeGoogleEvent(event({ start: { date: "2026-10-25" }, end: { date: "2026-10-27" } }));
  assert.equal(actual.isAllDay, true);
  assert.equal(actual.startsAt.toISOString(), "2026-10-25T00:00:00.000Z");
  assert.equal(actual.endsAt.toISOString(), "2026-10-27T00:00:00.000Z");
});
for (const [name, patch] of Object.entries({
  "missing start": { start: undefined }, "missing end": { end: {} },
  "invalid calendar day": { start: { dateTime: "2026-02-30T09:00:00Z" } },
  "unqualified local time": { start: { dateTime: "2026-10-25T09:00:00" } },
  "zero duration": { end: { dateTime: "2026-10-25T09:00:00+07:00" } },
  "inverted range": { end: { dateTime: "2026-10-24T09:00:00Z" } },
  "mixed all-day and timed": { start: { date: "2026-10-25" } },
  "invalid all-day date": { start: { date: "2026-02-30" }, end: { date: "2026-03-02" } },
  "invalid timezone": { start: { dateTime: "2026-10-25T09:00:00Z", timeZone: "bad/zone" } },
  "invalid updated timestamp": { updated: "invalid" },
  "unsafe link": { htmlLink: "javascript:alert(1)" },
  "missing identifier": { id: undefined },
})) {
  test(`normalizer rejects ${name} rather than guessing`, () => {
    assert.throws(() => normalizeGoogleEvent(event(patch)), { code: "invalid_google_data" });
  });
}
test("cancelled instances require no dates and optional details can be absent", () => {
  assert.equal(normalizeGoogleEvent({ id: "cancelled-instance", status: "cancelled" }), null);
  assert.equal(normalizeGoogleEvent(event({ summary: undefined })).title, "(Untitled event)");
});
test("modified recurring instances keep their stable expanded identifiers", () => {
  assert.equal(normalizeGoogleEvent(event({ id: "series_20261025T020000Z", recurringEventId: "series" })).googleEventId, "series_20261025T020000Z");
});

function apiModule(pages) {
  const calls = [];
  const api = { events: { list: async (params, options) => {
    calls.push({ params, options });
    const page = pages.shift();
    if (page instanceof Error) throw page;
    if (!page) throw new Error("Unexpected extra request");
    return { data: page };
  } } };
  const mod = loader({ googleapis: { google: {} } })(`${folder}calendar-api.ts`);
  return { ...mod, api, calls };
}
test("pagination follows empty pages and requests expanded instances with a timeout", async () => {
  const h = apiModule([{ items: [], nextPageToken: "next" }, { items: [event()] }]);
  const actual = await h.listGoogleEvents(h.api, "cal", from, to);
  assert.equal(actual.events.length, 1);
  assert.equal(h.calls[1].params.pageToken, "next");
  assert.equal(h.calls[0].params.singleEvents, true);
  assert.equal(h.calls[0].options.timeout, 15000);
});
test("oversized final page reports truncation even without another page token", async () => {
  const h = apiModule([{ items: [event({ id: "1" }), event({ id: "2" }), event({ id: "3" })] }]);
  assert.equal((await h.listGoogleEvents(h.api, "cal", from, to, 2)).truncated, true);
});
test("exact limit is complete only when no page remains", async () => {
  for (const next of [undefined, "next"]) {
    const h = apiModule([{ items: [event()], nextPageToken: next }]);
    assert.equal((await h.listGoogleEvents(h.api, "cal", from, to, 1)).truncated, Boolean(next));
  }
});
test("cancelled events count toward the bounded API snapshot", async () => {
  const h = apiModule([{ items: [{ id: "x", status: "cancelled" }], nextPageToken: "next" }]);
  assert.equal((await h.listGoogleEvents(h.api, "cal", from, to, 1)).truncated, true);
});
test("cyclic pagination, malformed lists and duplicate instances fail closed", async () => {
  for (const pages of [
    [{ items: [], nextPageToken: "loop" }, { items: [], nextPageToken: "loop" }],
    [{ items: {} }], [{ items: [event(), event()] }], [{ items: [event({ end: null })] }],
  ]) {
    const h = apiModule(pages);
    await assert.rejects(h.listGoogleEvents(h.api, "cal", from, to), { code: "invalid_google_data" });
  }
});
test("incomplete pagination rejects rather than returning a partial snapshot", async () => {
  const h = apiModule([{ items: [event()], nextPageToken: "next" }, new Error("network timeout")]);
  await assert.rejects(h.listGoogleEvents(h.api, "cal", from, to), /timeout/);
});

const OWNER = "11111111-1111-4111-8111-111111111111";
function syncHarness(fetchEvents = async () => ({ events: [normalizeGoogleEvent(event())], truncated: false })) {
  const connection = { ownerId: OWNER, googleAccountId: "account-a", refreshTokenEncrypted: "secret", updatedAt: from };
  let state = {
    connection,
    sources: ["a", "b"].map((id) => ({ id, googleCalendarId: id, ownerId: OWNER, connectionOwnerId: OWNER,
      selected: id === "a", syncStatus: "success", lastSuccessfulSync: from, lastSyncError: null, updatedAt: from })),
    mirrors: [{ ownerId: OWNER, sourceId: "a", googleEventId: "old" }],
  };
  let queue = Promise.resolve();
  let failWrite = false;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((part) => matches(row, part));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("not" in value) return !row[key].startsWith(value.not.startsWith);
      if ("lt" in value) return row[key] < value.lt;
    }
    return row[key] === value;
  });
  const scoped = (where) => assert.equal(where.ownerId, OWNER, "all source/mirror operations must use authenticated owner");
  const prisma = {
    $transaction: async (callback) => {
      const previous = queue;
      let release;
      queue = new Promise((r) => { release = r; });
      await previous;
      const before = structuredClone(state);
      const tx = {
        $queryRaw: async (strings, ownerId) => { assert.equal(ownerId, OWNER); return []; },
        googleCalendarConnection: { findUnique: async ({ where }) => { assert.equal(where.ownerId, OWNER); return state.connection; } },
        googleCalendarSource: {
          findMany: async ({ where }) => { scoped(where); return structuredClone(state.sources.filter((row) => matches(row, where))); },
          updateMany: async ({ where, data }) => {
            scoped(where);
            const rows = state.sources.filter((row) => matches(row, where));
            for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
            return { count: rows.length };
          },
        },
        googleEventMirror: {
          deleteMany: async ({ where }) => { scoped(where); state.mirrors = state.mirrors.filter((row) => !matches(row, where)); },
          createMany: async ({ data }) => {
            if (failWrite) throw new Error("simulated write failure");
            assert.ok(data.every((row) => row.ownerId === OWNER));
            state.mirrors.push(...data);
          },
        },
      };
      try { return await callback(tx); }
      catch (error) { state = before; throw error; }
      finally { release(); }
    },
  };
  const mod = loader({ "@/lib/prisma": { prisma }, "./calendar-api": {
    getCalendarClient: async () => ({}), listGoogleEvents: fetchEvents,
  } })(`${folder}import-sync.ts`);
  return { ...mod, connection, get state() { return state; }, failWrite: () => { failWrite = true; } };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
test("repeat sync replaces changed/removed mirrors without duplicates or local event access", async () => {
  let title = "First";
  const h = syncHarness(async () => ({ events: [normalizeGoogleEvent(event({ summary: title }))], truncated: false }));
  await h.importGoogleSnapshot(h.connection, ["a"]);
  title = "Updated";
  await h.importGoogleSnapshot(h.connection, ["a"]);
  assert.equal(h.state.mirrors.length, 1);
  assert.equal(h.state.mirrors[0].title, "Updated");
  assert.equal(h.state.sources[0].syncStatus, "success");
});
test("new selection clears old selection flags only after success", async () => {
  const h = syncHarness();
  await h.importGoogleSnapshot(h.connection, ["b"]);
  assert.deepEqual(h.state.sources.map((source) => source.selected), [false, true]);
});
test("foreign source selection never reaches Google or writes mirrors", async () => {
  const h = syncHarness(() => assert.fail("Google must not be called"));
  await assert.rejects(h.importGoogleSnapshot(h.connection, ["foreign"]), { code: "invalid_calendars" });
  assert.equal(h.state.mirrors[0].googleEventId, "old");
});
for (const failure of [new Error("revoked consent"), new Error("rate limit"), { code: "invalid_google_data" }, "truncated"]) {
  test(`failed snapshot preserves data and last success (${typeof failure === "string" ? failure : failure.message ?? failure.code})`, async () => {
    const h = syncHarness(async () => {
      if (failure === "truncated") return { events: [], truncated: true };
      throw failure;
    });
    await assert.rejects(h.importGoogleSnapshot(h.connection, ["a"]));
    assert.equal(h.state.mirrors[0].googleEventId, "old");
    assert.equal(h.state.sources[0].lastSuccessfulSync.getTime(), from.getTime());
    assert.equal(h.state.sources[0].syncStatus, "error");
  });
}
test("database failure rolls back deletes and releases the operation lease", async () => {
  const h = syncHarness();
  h.failWrite();
  await assert.rejects(h.importGoogleSnapshot(h.connection, ["a"]), /write failure/);
  assert.equal(h.state.mirrors[0].googleEventId, "old");
  assert.equal(h.state.sources[0].syncStatus, "error");
});
test("concurrent sync on a disjoint selection is rejected while first fetch is running", async () => {
  const started = deferred(); const finish = deferred();
  const h = syncHarness(async () => { started.resolve(); await finish.promise; return { events: [], truncated: false }; });
  const first = h.importGoogleSnapshot(h.connection, ["a"]);
  await started.promise;
  await assert.rejects(h.importGoogleSnapshot(h.connection, ["b"]), { code: "sync_busy" });
  finish.resolve(); await first;
  assert.equal(h.state.mirrors.length, 0);
});
test("expired worker cannot overwrite a newer snapshot or release a newer lease", async () => {
  const started = deferred(); const finish = deferred();
  const h = syncHarness(async () => { started.resolve(); await finish.promise; return { events: [], truncated: false }; });
  const first = h.importGoogleSnapshot(h.connection, ["a"]);
  await started.promise;
  h.state.sources.forEach((source) => { source.syncStatus = "syncing:new-worker"; });
  finish.resolve();
  await assert.rejects(first, { code: "sync_busy" });
  assert.equal(h.state.mirrors[0].googleEventId, "old");
  assert.ok(h.state.sources.every((source) => source.syncStatus === "syncing:new-worker"));
});
test("an expired abandoned lease can be reclaimed", async () => {
  const h = syncHarness();
  h.state.sources.forEach((source) => { source.syncStatus = "syncing:abandoned"; });
  await h.importGoogleSnapshot(h.connection, ["a"]);
  assert.equal(h.state.sources[0].syncStatus, "success");
});
test("account switch or disconnect during fetch invalidates the snapshot", async () => {
  for (const current of [null, { googleAccountId: "new-account" }]) {
    const h = syncHarness(async () => {
      h.state.connection = current;
      return { events: [], truncated: false };
    });
    await assert.rejects(h.importGoogleSnapshot(h.connection, ["a"]), { code: "connection_changed" });
    assert.equal(h.state.mirrors[0].googleEventId, "old");
  }
});
test("multi-calendar failure waits for remaining fetches and preserves every snapshot", async () => {
  const started = deferred(); const finish = deferred();
  const h = syncHarness(async (_api, calendarId) => {
    if (calendarId === "a") throw new Error("network failure");
    started.resolve(); await finish.promise;
    return { events: [], truncated: false };
  });
  const sync = h.importGoogleSnapshot(h.connection, ["a", "b"]);
  await started.promise;
  assert.ok(h.state.sources.every((source) => source.syncStatus.startsWith("syncing:")));
  finish.resolve();
  await assert.rejects(sync, /network failure/);
  assert.equal(h.state.mirrors[0].googleEventId, "old");
});
test("server action rejects excessive selection and propagates unauthenticated redirects", async () => {
  let unauthorized = false;
  const load = loader({
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "@/features/profile/data": { getMyAccount: async () => { if (unauthorized) throw new Error("redirect:/login"); return { user: { id: OWNER } }; } },
    "@/lib/prisma": { prisma: { googleCalendarConnection: { findUnique: async () => ({ ownerId: OWNER, targetCalendarId: null }) } } },
    "./calendar-api": {}, "./import-sync": { importGoogleSnapshot: () => assert.fail("must reject before syncing") }, "./push": {},
  });
  const { syncGoogleCalendars } = load(`${folder}import-actions.ts`);
  const data = new FormData(); ["a", "b", "c", "d"].forEach((id) => data.append("calendarId", id));
  await assert.rejects(syncGoogleCalendars(data), /redirect:\/settings\?google=too_many_calendars/);
  unauthorized = true;
  await assert.rejects(syncGoogleCalendars(data), /redirect:\/login/);
});
