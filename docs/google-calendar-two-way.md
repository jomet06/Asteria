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

`syncEventToGoogle` re-reads the row and skips: missing connection, read-only
scopes, occurrence exceptions (`parentId` set), and recurring series
(`recurrenceRule` set). Google failures are recorded on the row
(`syncState: "failed"`, generic `syncError`) and never fail the local action.

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

- **Recurring events stay local.** Asteria's JSON recurrence grammar is not yet
  translated to Google RRULE, and occurrence exceptions have no Google
  counterpart; pushing them is deferred.
- **Occurrence cancellations don't propagate.** Because recurring series are not
  pushed, exceptions/cancellations never reach Google.
- **Delete failures orphan.** If a Google delete fails after a local delete
  succeeded, the Google copy stays until manually removed.
- **Series edited into recurring** keep their old Google single event; the new
  local series is not pushed.
- **No incremental sync.** Import remains a bounded full-window replace
  (−90 … +365 days, ≤3 calendars, ≤2500 events each); `syncToken` sync is future work.

## Security notes

- Refresh tokens remain AES-256-GCM encrypted; push uses the same
  `getCalendarClient` path as import.
- Google API response bodies are never persisted: `syncError`/`lastSyncError`
  store generic messages only.
- All push queries are owner-scoped from the session, same as the rest of the app.
