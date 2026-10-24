# Google Calendar Two-Way Sync

Status: implemented (M3.7.3). Predecessors: M3.7.1 OAuth connect (`README_M3.7.1.txt`),
M3.7.2 one-way import (`20261023_google_calendar_import`).

## Direction summary

| Direction | Mechanism | Mutability |
|---|---|---|
| Google → Asteria | Manual "Sync Now" import into `GoogleEventMirror` rows, rendered as `kind: "google"` chips | Read-only mirrors |
| Asteria → Google | Synchronous push from calendar server actions into one dedicated **Asteria** calendar | Write |

## Scopes

`features/calendar/google/config.ts` now requests:

- `calendar.events` — create/update/delete events (two-way sync)
- `calendar.calendars` — create the dedicated Asteria calendar
- `calendar.calendarlist.readonly` — list importable calendars
- `openid`, `email`

Connections created before this milestone hold the old read-only scopes. They keep
importing, but push stays disabled until the user reconnects from Settings
(checked via `hasGoogleWriteScopes(grantedScopes)`).

## Target calendar

Pushed events never touch the user's personal calendars. `ensureTargetCalendar`
(`features/calendar/google/push.ts`):

1. Reuses `GoogleCalendarConnection.targetCalendarId` when set.
2. Otherwise looks for an owned calendar named **"Asteria"** in the calendar list
   (recovers from disconnect/reconnect without creating duplicates).
3. Otherwise creates one via `calendars.insert` and stores its id.

The target calendar is excluded from import (`loadGoogleCalendars` and
`syncGoogleCalendars` skip it) so a pushed event is never re-imported as a mirror.

## Push flow

`features/calendar/actions.ts`:

- `createCalendarEvent` → local row committed → `syncEventToGoogle`.
- `mutateEvent` (series update / series delete) → same, with the pre-delete
  `googleEventId` captured inside the transaction for `deleteEventFromGoogleAfterRemoval`.
- `mutateEvent` (occurrence edit / cancel) → `reconcileGoogleExceptionsForOwner`
  re-applies the series' exceptions to Google's instances.

`syncEventToGoogle` re-reads the row and skips: missing connection, read-only
scopes, and occurrence exceptions (`parentId` set — they ride along with their
series). Google failures are recorded on the row
(`syncState: "failed"`, generic `syncError`) and never fail the local action.

### Recurring series

Asteria's recurrence JSON is translated to RFC 5545 by `toRecurrenceRule`
(`features/calendar/recurrence.ts`): daily/weekly/monthly map to FREQ, weekly
emits `BYDAY` including the anchor weekday (Asteria's expansion always includes
the first instance), `until` becomes an inclusive `UNTIL` (date form for
all-day series, last local minute for timed ones), and `count` becomes `COUNT`.

Because Google keeps per-instance overrides when a recurring master is updated,
series updates use **delete + insert**: the old master is removed, a fresh one
is inserted, and the local exceptions are then reconciled against the fresh
instance list. The Google event id therefore changes on every series edit —
Asteria always stores the current id in `googleEventId`.

### Occurrence exceptions

After every series push (and after every occurrence edit/cancel), Asteria lists
the Google series' instances (`events.instances`, `showDeleted: true`, capped at
1000) and matches them to local exception rows by `originalStart`:

- edited exception → `events.patch` on the instance (fields + `status: confirmed`)
- cancelled exception → `events.patch` with `status: "cancelled"`

Per-instance failures are skipped; the series itself remains `synced`.

Push bodies carry `extendedProperties.private.asteriaEventId` for traceability.
All-day events use Google's exclusive `date` endpoints, matching Asteria's
exclusive all-day ends. A stale `googleEventId` that 404s on update is recreated
by insert on the same attempt.

## Retry / backfill

`retryPendingPushes` (Settings "Sync to Google" button, and piggybacked after every
successful manual import) pushes up to 100 non-recurring events per run where
`syncState != "synced"`. This covers failed pushes and events created before
two-way sync was enabled. `getMyGooglePushBacklog` drives the Settings counter.

## Known limitations

- **Google-side instance edits are not imported.** Mirrors stay read-only
  snapshots; an instance edited in Google is overwritten on the next series
  reconcile.
- **Reconciliation is best effort.** An instance patch that fails is skipped;
  the series stays `synced` and the divergence is not surfaced as an error row.
- **Delete failures orphan.** If a Google delete fails after a local delete
  succeeded, the Google copy stays until manually removed.
- **No incremental sync.** Import remains a bounded full-window replace
  (−90 … +365 days, ≤3 calendars, ≤2500 events each); `syncToken` sync is future work.

## Security notes

- Refresh tokens remain AES-256-GCM encrypted; push uses the same
  `getCalendarClient` path as import.
- Google API response bodies are never persisted: `syncError`/`lastSyncError`
  store generic messages only.
- All push queries are owner-scoped from the session, same as the rest of the app.
