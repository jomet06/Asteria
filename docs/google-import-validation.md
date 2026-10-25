# Google Calendar import validation

Verified locally on 2026-10-25. This report covers the import fixes below; it is
not a declaration that the entire product PRD has passed acceptance testing.

## Changes

- The server rejects more than three distinct calendar IDs with a visible
  Settings message. It does not silently truncate the selection. Empty,
  malformed, unavailable and Asteria push-target selections are rejected.
- Missing or invalid event dates fail the import without fabricating dates.
  Timed events require explicit UTC offsets; all-day events preserve Google's
  exclusive end date. Invalid pages, repeated pagination tokens, duplicate event
  IDs and incomplete snapshots also fail safely.
- Imports claim all existing calendar sources belonging to the authenticated
  owner. A random operation token in the existing `syncStatus` field fences
  concurrent workers; abandoned claims expire after five minutes. A stale worker
  cannot replace data or clear another worker's claim. Google requests run
  outside database transactions, with bounded request timeouts.
- Before claiming and before replacing mirrors, short database transactions
  lock the owner's connection row and check that its account, encrypted refresh
  token and update timestamp still match. Reconnect/disconnect invalidates an
  in-flight import. Snapshot replacement is atomic across selected sources;
  request, validation and transactional write failures preserve the previous
  successful mirrors, selection and last-success timestamp.
- The form disables submission while pending. Import only changes Google event
  mirrors; retrying outbound Asteria writes remains the separate existing push
  action in Settings.

No schema changes or new migrations are required for these fixes. No real
database mutations, migrations, Google syncs, commits or pushes were performed.
Pre-existing Discord/schema changes in the working tree are outside this report.

## Offline verification

Run the focused suite with `node scripts/check-google-import.mjs`. Its Google,
authentication and Prisma boundaries are mocked; it performs no network or
database operations. The suite includes rollback and interleaved-worker
scenarios, not just source-code assertions.

| Suite | Passed |
|---|---:|
| check-google-import.mjs | 40 |
| check-google-oauth.mjs | 3 |
| check-google-push.mjs | 10 |
| check-calendar.mjs | 44 |
| check-event-validation.mjs | 5 |
| check-recurrence-rrule.mjs | 5 |
| check-task-workspace.mjs | 36 |
| check-productivity-regression.mjs | 13 |
| check-task-planning-fields.mjs | 3 |
| check-dashboard.mjs | 4 |
| check-hermes.mjs | 10 |
| check-discord.mjs | 5 |
| check-prisma-cache.mjs | 4 |
| **Total** | **182** |

All listed suites passed with zero failures. Each was run directly with Node.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npx prisma validate --config prisma7.config.ts` | Passed |
| `npm run build` | Passed on the final run; all 19 pages generated |

The first build stopped at Next.js's security upgrade reminder after compilation
and page generation. The final run exited successfully but still warned that
installed Next.js 16.4.0 has a known vulnerability. A dependency security update
remains separate follow-up work; these fixes do not resolve that warning.

## Remaining acceptance checks

- Exercise Settings and the calendar in a browser with a connected test Google
  account: selection limits, pending state, successful sync and read-only chips.
- Verify real Google timed, all-day, recurring and cancelled events, API failure,
  reconnect and disconnect behavior against a disposable test dataset.
- Verify transaction rollback, row locking, concurrent imports and abandoned
  claim recovery against PostgreSQL. Mocked tests cannot establish production
  transaction behavior or the deployed database's schema/permissions.
- Database deployment and any real data mutation still require the user's
  explicit approval. No production-readiness or full-PRD completion claim is made.

Google API references: [event representation](https://developers.google.com/workspace/calendar/api/v3/reference/events)
and [event pagination](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
