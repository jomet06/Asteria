/* Offline checks for two-way Google Calendar push: no network or live database. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const googleFolder = resolve(root, "features/calendar/google");

function loadFile(absolutePath, mocks = {}) {
  const code = ts.transpileModule(readFileSync(absolutePath, "utf8"), {
    fileName: absolutePath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleRecord = { exports: {} };
  const require = (spec) => {
    if (Object.hasOwn(mocks, spec)) return mocks[spec];
    if (spec.startsWith(".")) {
      const target = resolve(dirname(absolutePath), spec);
      return loadFile(/\.(ts|tsx)$/.test(target) ? target : `${target}.ts`, mocks);
    }
    return nativeRequire(spec);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolutePath })(
    require,
    moduleRecord,
    moduleRecord.exports
  );
  return moduleRecord.exports;
}

const WRITE_SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars https://www.googleapis.com/auth/calendar.calendarlist.readonly openid email";
const READONLY_SCOPES =
  "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly openid email";

function fakePrisma({ connection = null, event = null, events = [] } = {}) {
  const calls = { connectionUpdates: [], eventUpdates: [] };
  const prisma = {
    googleCalendarConnection: {
      findUnique: async () => connection,
      update: async ({ data }) => {
        calls.connectionUpdates.push(data);
        return {};
      },
    },
    calendarEvent: {
      findFirst: async () => event,
      findMany: async () => events,
      update: async ({ where, data }) => {
        calls.eventUpdates.push({ where, data });
        return {};
      },
    },
  };
  return { prisma, calls };
}

function fakeApi({ calendarItems = [], insertedCalendarId = "cal_asteria", insertResults = [], updateResults = [], instances = [] } = {}) {
  const calls = { calendarInserts: [], eventInserts: [], eventUpdates: [], eventDeletes: [], eventPatches: [] };
  let insertSeq = 0;
  let updateSeq = 0;
  const api = {
    calendarList: { list: async () => ({ data: { items: calendarItems } }) },
    calendars: {
      insert: async ({ requestBody }) => {
        calls.calendarInserts.push(requestBody);
        return { data: { id: insertedCalendarId } };
      },
    },
    events: {
      insert: async ({ requestBody }) => {
        calls.eventInserts.push(requestBody);
        const result = insertResults[insertSeq++];
        if (result instanceof Error) throw result;
        return result ?? { data: { id: `ge_${insertSeq}` } };
      },
      update: async ({ requestBody }) => {
        calls.eventUpdates.push(requestBody);
        const result = updateResults[updateSeq++];
        if (result instanceof Error) throw result;
        return result ?? { data: { id: `geu_${updateSeq}` } };
      },
      delete: async ({ eventId }) => {
        calls.eventDeletes.push(eventId);
        return { data: {} };
      },
      instances: async () => ({ data: { items: instances } }),
      patch: async ({ eventId, requestBody }) => {
        calls.eventPatches.push({ eventId, requestBody });
        return { data: { id: eventId } };
      },
    },
  };
  return { api, calls };
}

function pushModule(mocks) {
  return loadFile(resolve(googleFolder, "push.ts"), mocks);
}

function baseEvent(overrides = {}) {
  return {
    id: "e1",
    title: "Study session",
    description: null,
    location: null,
    startsAt: new Date("2026-10-23T17:00:00.000Z"),
    endsAt: new Date("2026-10-23T18:00:00.000Z"),
    timezone: "Asia/Jakarta",
    isAllDay: false,
    googleEventId: null,
    parentId: null,
    recurrenceRule: null,
    ...overrides,
  };
}

test("write scopes gate two-way sync", () => {
  const config = loadFile(resolve(googleFolder, "config.ts"));
  assert.equal(config.hasGoogleWriteScopes(WRITE_SCOPES), true);
  assert.equal(config.hasGoogleWriteScopes(READONLY_SCOPES), false);
});

test("first push creates the Asteria calendar once and marks the event synced", async () => {
  const event = baseEvent();
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: null },
    event,
  });
  const { api, calls: apiCalls } = fakeApi();
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "e1");

  assert.equal(calls.connectionUpdates[0].targetCalendarId, "cal_asteria");
  assert.equal(apiCalls.calendarInserts[0].summary, "Asteria");
  assert.equal(calls.eventUpdates.length, 1);
  assert.deepEqual(calls.eventUpdates[0].data, { googleEventId: "ge_1", syncState: "synced", syncError: null });
  assert.equal(apiCalls.eventInserts[0].start.dateTime, "2026-10-23T17:00:00.000Z");
  assert.equal(apiCalls.eventInserts[0].start.timeZone, "Asia/Jakarta");
  assert.equal(apiCalls.eventInserts[0].extendedProperties.private.asteriaEventId, "e1");
});

test("all-day events use exclusive Google dates", async () => {
  // One full day (Oct 24) in Jakarta: ends Oct 25 00:00 WIB = 2026-10-24T17:00Z.
  const event = baseEvent({
    isAllDay: true,
    startsAt: new Date("2026-10-23T17:00:00.000Z"),
    endsAt: new Date("2026-10-24T17:00:00.000Z"),
  });
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    event,
  });
  const { api, calls: apiCalls } = fakeApi();
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "e1");

  assert.equal(apiCalls.eventInserts[0].start.date, "2026-10-24");
  assert.equal(apiCalls.eventInserts[0].end.date, "2026-10-25");
  assert.equal(calls.eventUpdates[0].data.syncState, "synced");
});

test("a deleted Google event is recreated on the same attempt", async () => {
  const event = baseEvent({ googleEventId: "stale" });
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    event,
  });
  const { api } = fakeApi({ updateResults: [Object.assign(new Error("gone"), { status: 404 })] });
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "e1");

  assert.equal(calls.eventUpdates[0].data.googleEventId, "ge_1");
  assert.equal(calls.eventUpdates[0].data.syncState, "synced");
});

test("Google failures mark the event failed with a generic message", async () => {
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    event: baseEvent(),
  });
  const { api } = fakeApi({ insertResults: [Object.assign(new Error("rate"), { status: 429 })] });
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "e1");

  assert.equal(calls.eventUpdates[0].data.syncState, "failed");
  assert.match(calls.eventUpdates[0].data.syncError, /rate limit/i);
  assert.doesNotMatch(calls.eventUpdates[0].data.syncError, /response body/i);
});

test("occurrence exceptions never reach Google directly", async () => {
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    event: baseEvent({ parentId: "parent" }),
  });
  const { api, calls: apiCalls } = fakeApi();
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "e1");

  assert.equal(calls.eventUpdates.length, 0);
  assert.equal(apiCalls.eventInserts.length, 0);
});

test("retry pushes unsynced non-recurring events and reports counts", async () => {
  const events = [baseEvent({ id: "a", syncState: "failed" }), baseEvent({ id: "b", syncState: "local" })];
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    events,
  });
  const { api } = fakeApi({ insertResults: [{ data: { id: "ok" } }, Object.assign(new Error("x"), { status: 500 })] });
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  const summary = await push.retryPendingPushes("u1");

  assert.deepEqual(summary, { attempted: 2, pushed: 1, failed: 1, skipped: false });
  assert.equal(calls.eventUpdates.length, 2);
});

test("retry is skipped for read-only connections", async () => {
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: READONLY_SCOPES, targetCalendarId: null },
    events: [baseEvent()],
  });
  const { api, calls: apiCalls } = fakeApi();
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  const summary = await push.retryPendingPushes("u1");

  assert.equal(summary.skipped, true);
  assert.equal(calls.eventUpdates.length, 0);
  assert.equal(apiCalls.eventInserts.length, 0);
});

test("recurring series are replaced wholesale and exceptions reconcile", async () => {
  // Anchor: Sat Oct 24 00:00 WIB → BYDAY gains SA next to the selected MO,WE.
  const series = baseEvent({
    id: "series1",
    recurrenceRule: '{"frequency":"weekly","weekdays":[1,3]}',
    googleEventId: "old-master",
  });
  const exceptions = [
    {
      id: "ex-edited",
      ownerId: "u1",
      parentId: "series1",
      title: "Moved occurrence",
      description: null,
      location: null,
      startsAt: new Date("2026-10-26T02:00:00.000Z"),
      endsAt: new Date("2026-10-26T03:00:00.000Z"),
      timezone: "Asia/Jakarta",
      isAllDay: false,
      isCancelled: false,
      originalStart: new Date("2026-10-26T01:00:00.000Z"),
    },
    {
      id: "ex-cancelled",
      ownerId: "u1",
      parentId: "series1",
      title: "Dropped occurrence",
      description: null,
      location: null,
      startsAt: new Date("2026-10-28T01:00:00.000Z"),
      endsAt: new Date("2026-10-28T02:00:00.000Z"),
      timezone: "Asia/Jakarta",
      isAllDay: false,
      isCancelled: true,
      originalStart: new Date("2026-10-28T01:00:00.000Z"),
    },
  ];
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    event: series,
    events: exceptions,
  });
  const { api, calls: apiCalls } = fakeApi({
    instances: [
      { id: "inst-edited", originalStartTime: { dateTime: "2026-10-26T01:00:00.000Z" }, status: "confirmed" },
      { id: "inst-cancelled", originalStartTime: { dateTime: "2026-10-28T01:00:00.000Z" }, status: "confirmed" },
    ],
  });
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  await push.syncEventToGoogle("u1", "series1");

  // The old master is removed and a fresh RRULE series is inserted.
  assert.deepEqual(apiCalls.eventDeletes, ["old-master"]);
  assert.equal(apiCalls.eventInserts[0].recurrence[0], "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,SA");
  assert.deepEqual(calls.eventUpdates[0].data, { googleEventId: "ge_1", syncState: "synced", syncError: null });

  // Edited instance becomes a Google override; cancelled one is cancelled.
  assert.equal(apiCalls.eventPatches.length, 2);
  const edited = apiCalls.eventPatches.find((patch) => patch.eventId === "inst-edited");
  const cancelled = apiCalls.eventPatches.find((patch) => patch.eventId === "inst-cancelled");
  assert.equal(edited.requestBody.summary, "Moved occurrence");
  assert.equal(edited.requestBody.status, "confirmed");
  assert.equal(cancelled.requestBody.status, "cancelled");
});

test("retry pushes recurring series and reconciles their exceptions", async () => {
  const series = baseEvent({
    id: "series2",
    recurrenceRule: '{"frequency":"daily","weekdays":[]}',
    syncState: "local",
  });
  const { prisma, calls } = fakePrisma({
    connection: { ownerId: "u1", refreshTokenEncrypted: "enc", grantedScopes: WRITE_SCOPES, targetCalendarId: "cal_asteria" },
    events: [series],
  });
  const { api } = fakeApi();
  const push = pushModule({ "@/lib/prisma": { prisma }, "./calendar-api": { getCalendarClient: async () => api } });

  const summary = await push.retryPendingPushes("u1");

  assert.deepEqual(summary, { attempted: 1, pushed: 1, failed: 0, skipped: false });
  assert.equal(calls.eventUpdates[0].data.syncState, "synced");
});
