# Internal Calendar M3

## File inventory

Modified: `app/calendar/page.tsx`, `features/calendar/actions.ts`, `features/calendar/data.ts`, `features/calendar/components/event-manager.tsx`, `prisma/schema.prisma`.

Added or completed from existing untracked work: `features/calendar/components/calendar-views.tsx`, `features/calendar/recurrence.ts`, `features/calendar/validation.ts`, `app/calendar/loading.tsx`, `app/calendar/error.tsx`, `prisma/migrations/20261022_calendar_completion/migration.sql`, `scripts/check-calendar.mjs`, `scripts/check-calendar-completion-schema.mjs`, and this document.

The pre-existing local changes in the calendar page/data/views were incorporated; no commit, push, reset, or database migration was performed.

## Implementation

- Month uses a 42-cell Monday-first grid. Week/day split overnight events at local midnight and allocate overlap lanes. Navigation preserves date/view, and month queries include adjacent grid dates.
- CalendarEvent stores standalone events, recurrence series, and task time blocks. Task deadlines and daily plans are read-only projections of their existing records, with source navigation. Cancelled task deadlines are hidden; completed deadlines retain their status. Planner entries retain planned-date/position order.
- Recurrence is normalized JSON: daily, weekly (Sunday=0), or monthly. DTSTART is always the first occurrence, including when not among selected weekly weekdays. Until dates are inclusive in the event timezone; counts include cancelled/overridden occurrences. Missing monthly dates are skipped, never clamped.
- Supported timezones are Asia/Jakarta, Asia/Makassar, Asia/Jayapura, and UTC. These have fixed offsets for the application's contemporary scheduling use. Historical timezone changes and other IANA zones are not supported. All-day form end dates are inclusive; stored end instants are exclusive.
- Occurrence exceptions are CalendarEvent child rows keyed by `(parentId, originalStart)`. Overrides replace an occurrence; cancellation tombstones suppress it. Moving an occurrence outside its original range remains discoverable. Expansion never creates rows.
- Editing the entire series explicitly resets all overrides/cancellations; the editor warns about this. Occurrence edits retain their parent task association. Whole-series edits use the original series start/end.
- Composite foreign keys enforce matching owner IDs for task associations and parent series. Deleting a task cascades to its time blocks, including exceptions; deleting a time block never deletes a task or changes task status. Deleting a series cascades to its exceptions.
- Every action authenticates, derives owner from the session, validates inputs, rejects submitted ownerId, and scopes reads/writes. Series mutations lock the owned row inside a transaction to serialize exception/series changes.
- Conflict warnings use strict half-open overlap, including recurring/overnight events. Saving again explicitly acknowledges the warning. Checking covers the proposed series' first 366 days, with visible warnings when results are capped; it does not guarantee conflicts beyond that horizon. Concurrent saves can still conflict because warnings are advisory.

## Bounds

- Input dates: 1900–2100; maximum event duration: 366 days; recurrence count: 1–10,000.
- Expansion accepts at most 740 requested days; daily/weekly rules jump to the requested range, monthly rules scan at most 2,412 months.
- Reads cap candidate series, displayed event instances, deadlines, planner entries, and task options at 500 each, fetching one extra record to signal truncation. Recurring candidate queries include past series so future occurrences are discoverable. Expired series can consume the candidate cap in very large calendars; truncation is shown rather than claiming completeness.
- A series supports 500 exceptions. Further new exceptions are rejected. Unexpected existing data beyond that cap fails visibly rather than restoring suppressed occurrences.

## Migration and verification status

`prisma/migrations/20261022_calendar_completion/migration.sql` is a forward-only additive migration. It adds task/parent/occurrence/cancellation columns, composite ownership foreign keys, unique constraints, an exception-shape check, and a task index. Existing rows are retained; existing RLS and revoked browser-role privileges continue to apply.

The migration is **pending, not applied**. Applying schema changes to the connected database requires the user's explicit approval. Until migration, the calendar uses an owner-scoped legacy-column read fallback and disables event creation/editing in the UI. Deadlines and Planner projections remain available. Full mutations, exceptions and time blocking require migration. Only missing completion-column errors activate this fallback; unrelated database errors still surface.

### Pre-migration audit (2026-10-21)

Read-only queries against the effective `DIRECT_URL` confirmed:

- Host `aws-0-ap-southeast-1.pooler.supabase.com`, port 5432, database `postgres`, schema `public`, PostgreSQL 17.11; primary, not a replica.
- Supabase project reference `szrvdeoqryepgcgimhnn` matches both `DATABASE_URL` and the public Supabase Auth URL. Effective `DIRECT_URL` equals the value in `.env.local`; no inherited override was detected. The configured application origin is `http://localhost:3000`.
- This proves configuration consistency, **not** that the hosted project is dedicated to development. No authoritative development/production designation was found locally. The user must confirm that project reference before approving execution.
- Calendar contains 1 existing row, 0 invalid time ranges/blank titles, 0 missing profile owners, and 0 existing recurrence rules. No event contents or credentials were printed.
- All five existing migrations completed without rollback. Completion migration is absent from history; its four new columns do not yet exist.
- Existing calendar primary key and non-null owner make `(id, owner_id)` uniqueness compatible with every existing row. `tasks_id_owner_unique` exists for the composite task FK.
- New nullable task/parent/original-start columns initialize to NULL; cancellation initializes to FALSE. Thus existing rows satisfy the exception-shape check and nullable foreign keys without data updates. Standalone rows may share NULL exception keys because PostgreSQL unique constraints permit multiple NULLs.
- SQL contains no DELETE, TRUNCATE, DROP, or UPDATE statements against user rows. It does not alter existing event titles, times, ownership, or recurrence rules. Existing RLS and browser-role grants are unchanged; all 14 audited anon/authenticated privileges are denied.
- Future deletion of a Task cascades to associated time blocks; future deletion of a series cascades to its exception rows. Neither effect deletes existing standalone events when the migration runs; deleting a time block never deletes its Task.
- All DDL runs within one transaction. Constraint/index creation can acquire locks and scan the table (currently 64 kB including indexes). Local lock timeout is 5 seconds and statement timeout is 120 seconds, so lock contention or a slow statement aborts instead of waiting indefinitely. A failed deployment must be inspected before any retry or migration-history repair.
- Recurrence membership, parent-is-series rules, and acyclic exception structure are validated by the application; the migration's composite FKs enforce ownership but do not independently enforce those higher-level rules for privileged direct SQL writers.

Audit outcome: compatible with the existing rows and ready for explicit target confirmation/approval. No migration or other database write was performed. After approval, recheck pending migrations and target identity, deploy only the reviewed pending completion migration, generate Prisma Client, and run the post-migration verification and acceptance workflow.

Verified locally:

- Prisma validate and generate: passed, using existing `prisma7.config.ts` and `.env.local`.
- TypeScript: passed.
- ESLint with `--max-warnings=0`: passed, zero errors/warnings.
- Production build: passed.
- Production HTTP smoke check: unauthenticated Calendar response correctly carries a login redirect (streamed response status 200).
- Calendar suite: 44 passed, zero failed. Uses mocked persistence/auth for mutation and authorization cases, plus actual recurrence/date functions and React server-render checks for month/week/day and overlap lanes.
- Existing task workspace/productivity regression suites: 49 passed, zero failed.
- Existing calendar schema/security check: passed on the connected database, read-only.
- Productivity database security check: passed on the connected database, read-only.
- Prisma migrate status: reports the completion migration pending (expected nonzero exit).
- Completion schema check: reports the pending migration. New foreign keys/cascades/constraints are reviewed and statically tested but are not yet verified on the connected database.

Run `node scripts/check-calendar-completion-schema.mjs` after the approved migration; this checks migration history, composite ownership foreign keys/cascades, exception uniqueness, RLS, browser permissions, and existing association integrity without writing data. No destructive live fixtures were used.

## Manual acceptance checklist after migration

- Sign in; open month/week/day on desktop and a narrow mobile viewport. Navigate Dec/Jan, Today, date input, adjacent month dates, and browser back/forward.
- Create, inspect, edit, and delete timed, all-day, multi-day, and overnight events in each supported timezone. Check keyboard focus, labels, saving state, error/retry, and empty dates.
- Create daily, selected-weekday weekly, and monthly recurrence with never/until/count endings. Inspect the 29th–31st through February and leap years.
- Move one occurrence across months, cancel another, refresh, then edit/delete the entire series. Verify the explicit whole-series reset warning and resulting exceptions.
- Create overlapping, adjacent, cross-midnight, and recurring conflicts. Confirm the first save warns, a second save proceeds, and changing fields requires fresh acknowledgment.
- Change an existing Task deadline and refresh Calendar. Verify status and deadline display; open a planner projection at its original date and confirm ordering is unchanged.
- Create a Task time block; verify task status is unchanged. Delete the block and confirm the Task remains. In dedicated fixtures only, delete a Task and verify its blocks disappear.
- With separate test accounts, verify no event/task/planner leakage and no cross-user update/delete or association. Do not delete real user data to test these cases.
- Run the completion schema check; verify the authenticated calendar page and all mutations against the migrated database. Full interactive browser acceptance remains outstanding.

## Calendar availability fix

The missing `calendar_events.task_id` column caused Prisma P2022 while rendering the Calendar page before migration. A narrowly scoped compatibility fallback now selects only existing columns and preserves owner/date bounds. The page shows a read-only notice and disables mutation controls until the completion schema is present. No schema changes were applied. Two regression cases cover legacy-schema availability and propagation of unrelated database errors.

Fix verification: 93 automated tests passed (44 Calendar + 49 Productivity), TypeScript passed, ESLint passed with zero warnings, and production build passed. The real loader was also exercised read-only against both configured runtime and direct connections with a synthetic owner UUID: schemaPending=true and zero leaked events. Interactive signed-in browser verification remains outstanding.

## Development Prisma cache fix

The running Next dev process retained a Prisma Client generated before Calendar exception fields were added. The server log reported PrismaClientValidationError: unknown argument parentId, before any database query; therefore the missing-column fallback did not apply. `lib/prisma.ts` now versions its development singleton against the generated Calendar scalar-field enum, replacing legacy/unmatched instances while reusing matching instances. Three regression tests cover unversioned, matching and changed-schema caches.

Browser verification on the existing signed-in Chrome tab succeeded after reload: the Calendar month grid, existing event, Task deadlines and read-only update notice rendered. No database migration or data mutation was performed. Full post-migration mutation acceptance remains pending. Combined automated suites: 96 passed, zero failed.
