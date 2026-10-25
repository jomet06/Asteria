# Asteria Notification System — implementation and rollout report

Status: **migration `20261026_notification_system` applied and verified on 2026-10-25 at 23:08 (Asia/Bangkok), after explicit user approval**. All 12 migrations are applied and the database is up to date. Counts and content fingerprints of 12 existing business tables matched the preflight baseline. Live scheduler activation remains separate; no live scheduler invocation, Google API operation or test Discord message was performed. Baseline inspected: clean checkout at `b6312c8` (`fix: finalize ui`).

## Features

- Persistent notification center in the authenticated top bar: unread badge, item/read-all actions, dismissal, older-history pagination, and resource navigation. Task links now open the matching task detail drawer.
- Accessible Radix popover, keyboard Escape/focus return, constrained height and internal scrolling, mobile sizing, semantic light/dark tokens, loading/error/empty/paused/schema-pending states.
- Browser polling every 60 seconds, or 20 seconds while open. Hidden tabs do not request data. Polling pauses while browsing older history and resumes when the panel is reopened. Reads never generate reminders.
- Settings channel/category controls, event lead times (5/10/15/30/60 minutes), deadline lead times (0/1/2/3/7 days), local morning hour, and overdue repetition (daily or once per deadline).
- One canonical pipeline for Calendar, Tasks, Daily Planner, in-app history and Discord; the existing gateway tick delegates to it.

## Audit findings and fixes

| Finding in the previous code | Implemented behavior |
| --- | --- |
| `due.slice(0,20)` before dedupe allowed old reminders to fill the send budget | Persist candidates idempotently, select only pending/retry/stale claims, then bound dispatch. Sent records never occupy the ready window. |
| First 100 Discord connections repeatedly selected | Persistent, wrapping UUID cursors for profile collection and a separate cursor over ready delivery owners. |
| Failed delivery deleted its log and retried every minute | Notification history survives; delivery has attempts, terminal state, scheduled retry, safe error code and backoff. |
| Insert-before-send could lose notifications after a crash | Separate durable queue; atomic compare-and-set claim, lease expiry recovery, random fencing token and conditional acknowledgement. |
| Relinking upserted by Discord ID and attempted to move `ownerId` | Lock the pairing owner's profile, consume code atomically, upsert by owner. Discord already owned by someone else is refused; unique conflicts roll back code consumption. |
| UTC-midnight date-only deadlines became exact morning instants | Preserve their date through the end of the owner's local day. Advance reminder uses local morning on the configured previous calendar day. |

The deleted Google OAuth callback from earlier work is present and tracked in the inspected baseline. This task does not restore, replace or modify it, Supabase login, Google import/sync, or the local CalendarEvent storage model.

## Architecture and source files

Added:

- `features/notifications/types.ts`: inbox, preferences, candidate and action contracts.
- `features/notifications/preferences.ts`: defaults, strict input whitelist, category policy and narrow missing-schema detection.
- `features/notifications/policy.ts`: pure timing, date-only semantics, planner fingerprints, hashing and retry policy.
- `features/notifications/service.ts`: owner-scoped reconciliation, transactional persistence, shared preference locking and pre-delivery resource validation.
- `features/notifications/scheduler.ts`: bounded traversal, global lease, fair delivery selection and fenced delivery claims.
- `features/notifications/data.ts`: owner-scoped inbox pagination/preferences, private history and internal navigation allowlist.
- `features/notifications/actions.ts`: authenticated read/read-all/dismiss/preferences server actions.
- `features/notifications/components/notification-bell.tsx`, `notification-item.tsx`, `notification-settings.tsx`.
- `app/api/notifications/route.ts`, `app/api/notifications/tick/route.ts`.
- `prisma/migrations/20261026_notification_system/migration.sql`.
- `scripts/check-notifications.mjs`, `scripts/check-notification-schema.mjs` (read-only live preflight/post-migration audit), and this report. Verification output in `artifacts/notifications/` is local and gitignored; screenshots may contain account details and are not published.

Modified:

- `prisma/schema.prisma`, `lib/prisma.ts`: additive models and hot-reload schema signature.
- `components/app-sidebar.tsx`, `app/settings/page.tsx`: actual UI integration and mobile Settings grid overflow correction.
- `features/tasks/components/task-workspace.tsx`: owner-loaded task deep links and clean URL after closing details.
- `features/discord/notifications.ts`, `rest.ts`, `link.ts`, `app/api/discord/tick/route.ts`, `scripts/discord-bot.mjs`: shared scheduler delegation, response classification, safe relinking, bounded gateway ticks with overlap guard and HTTP error reporting.
- `features/hermes/context.ts`, `agent.ts`: read-only notification preferences in context; no new Gemini tools or model-written notification records.
- `scripts/check-discord.mjs`, `check-hermes.mjs`, `check-task-workspace.mjs`: updated mocks/regressions and additional Discord reliability tests.

## Trigger → persistence → delivery

1. Trusted scheduler POST acquires the singleton scheduler lease; an overlapping invocation returns `busy`.
2. Traverse at most 25 profile owners, respecting a collection time budget. Every source query is owner-scoped. One failing owner does not block other owners or the existing delivery queue.
3. Reuse `loadCalendarEvents` for expanded recurring occurrences, cancellation/move exceptions and existing Google mirrors. There are no live Google fetches or Google-to-local-event writes here.
4. Traverse 100 open dated tasks per owner using a persisted keyset cursor. Read today's plan plus up to five future plan dates per pass, rotating through future dates.
5. Lock the owner's preferences. A preference snapshot changed during collection is discarded and recollected later. Category/channel rules apply before publishing. Create unique notification rows and channel deliveries in the same transaction, using bulk writes for event/task candidates.
6. Bell reads committed history. UI actions derive owner from `requireUser`; the API derives it from Supabase `getUser`, ignoring any client owner parameter.
7. Select distinct ready owners (up to 20), independently from collection. Round-robin dispatch attempts at most 20 entries, with at most five per selected owner and a 50-second soft run budget.
8. Atomically claim a delivery for 30 seconds. Revalidate current preferences, link, notification state/expiry, resource ownership, task status, event occurrence/cancellation, or current plan fingerprint. Renew the claim immediately before the 10-second HTTP call.
9. Record success only under the matching claim token. Retry transient errors up to five external attempts with 30/60/120/240-second exponential intervals; respect Discord `retry_after` up to one hour. Permanent HTTP failures are terminal. A stale abandoned claim can be reclaimed; a previous token cannot acknowledge or clear a newer claim.

Calendar default: 15 minutes before the occurrence until its start. All-day dates remain floating calendar dates and are reminded before midnight in the owner's timezone. Timed Google events retain their absolute timestamps. Supported profile zones follow the rest of Asteria: Jakarta, Makassar, Jayapura, UTC.

Task default: one calendar day ahead at 07:00 for date-only deadlines; 24 hours ahead for existing exact timestamps. Midnight UTC follows the existing date-only storage convention. DONE/CANCELLED tasks are excluded. Overdue reminders expire at the next local midnight and dedupe per local day, or per task/deadline version in once-only mode.

Planner: fingerprint the date and stable ordered task IDs/positions. Unchanged regeneration does not repeat. A changed plan produces a new version; today's already-announced identical plan suppresses the morning duplicate. A plan announced on an earlier day may receive today's summary between the chosen morning hour and noon. Historical legacy summaries establish a silent fingerprint baseline.

## Database migration and ownership

`NotificationLog` remains the canonical model/table and its existing unique `(owner_id,kind,ref_key)` is preserved. Add nullable display/resource/timing/read/dismiss metadata, `in_app` (false for historical rows), and `legacy_discord_sent`. Existing rows receive legacy=true; the default changes to false for future rows. Existing timestamps and history remain intact. Short dedupe keys stay compatible; long keys use SHA-256 instead of truncation. Old truncated Google markers suppress replay conservatively.

New tables:

- `notification_preferences`: owner primary key/FK → profiles, delete/update cascade; booleans and validated timing values, plus internal traversal cursors.
- `notification_deliveries`: notification/channel unique; composite `(notification_id,owner_id)` FK → notification_logs `(id,owner_id)`, delete/update cascade. This prevents cross-owner deliveries at the database level. Profile deletion cascades through existing logs into deliveries.
- `notification_scheduler_state`: one internal lease/cursor record; UUID cursors are traversal positions rather than resource ownership grants and deliberately have no profile FK.

Indexes cover inbox/unread retrieval, source fingerprints, delivery readiness and per-owner retries. All four notification tables have RLS enabled and privileges revoked from PUBLIC/anon/authenticated, matching existing privileged-server Prisma conventions. There are no browser Supabase table subscriptions or permissive client policies. Resource references are polymorphic (including virtual recurrence IDs), so resource ownership is enforced by the owner-scoped constructors and delivery revalidation rather than a generic resource FK.

Risk: additive DDL takes locks on `notification_logs` and builds new indexes. Existing data volume determines runtime/disk requirements. The transaction uses 5-second lock and 120-second statement timeouts; a failure rolls back. No existing tasks, events, users or logs are deleted. The approved live migration completed successfully. Read-only PostgreSQL catalog verification confirmed columns/defaults, unique indexes, checks, owner FKs/cascades, enabled RLS and denied anon/authenticated privileges. All 12 business-table counts/content digests remained unchanged. Concurrent delivery/locking behavior is tested offline; no live provider delivery test was performed.

Rollout: pause old reminder workers before applying the approved migration, deploy the matching application/client together, verify schema and UI, and only then activate scheduling. An old worker must not continue writing old-format markers during rollout. Previously unannounced overdue tasks and existing plans can produce first-run notifications under the enabled defaults; consider disabling Discord for the acceptance account first.

## Delivery guarantees and limits

- Database creation is idempotent through unique constraints and transactions. Dispatch claims are exclusive while valid and acknowledgements are fenced.
- **Discord is not exactly-once.** A provider accepting a message followed by a crash, lost acknowledgement or ambiguous network timeout can cause a later retry to duplicate it. Bounded retries can also exhaust without delivery. No provider-level idempotency guarantee is assumed.
- Preferences, dismissal and disconnect/relink are checked again before sending. Already-in-flight provider requests cannot be recalled. Reading an item does not cancel its Discord reminder; dismissal does.
- Disabling categories/channel cancels outstanding deliveries. Re-enabling does not replay cancelled/sent deliveries. In-app history stays visible while new in-app notifications are paused. Lead-time changes do not rewrite history.
- Timing is best effort at scheduler cadence. Downtime beyond an event/deadline validity window skips stale reminders instead of sending them late. Larger installations need a faster cadence or larger capacity after measurement; rotating owners/tasks can delay reminders under load.
- Existing calendar loader bounds remain 500 expanded/imported events per window and 500 exceptions per series. Plans above 100 active items are skipped instead of summarizing incomplete data. The tick reports `truncated`; operators must monitor it. No silent claim of unlimited scheduling capacity is made.
- Retention/archival of growing notification history and a user-facing manual retry UI are future operational improvements; failed deliveries remain available to trusted operators, without automatic infinite retries.
- UI populated read/dismiss/preference behavior is validated offline with transaction doubles. Initial browser validation exercised the real authenticated schema-pending UI, not fabricated live notification data. Migration and live catalog/data verification are now complete; full provider delivery acceptance still requires an authorized test account and scheduler activation.

## Environment and scheduling

Server only:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing privileged Prisma server connection; unchanged. |
| `NOTIFICATIONS_SCHEDULER_SECRET` | New high-entropy shared secret for the dedicated scheduler endpoint. Never use a NEXT_PUBLIC variable. |
| `DISCORD_BOT_TOKEN` | Existing bot REST credential; required only for Discord delivery. In-app generation works without it. |
| `DISCORD_INTERNAL_SECRET` | Existing gateway inbox/legacy tick secret, unchanged. |
| `ASTERIA_INTERNAL_URL` | Existing gateway's backend address; confirm the runner's environment/default before activation. |

Configure a trusted worker/deployment scheduler to POST once per minute:

```sh
curl --fail-with-body --silent --show-error --connect-timeout 5 --max-time 60 \
  --request POST \
  --header "Authorization: Bearer ${NOTIFICATIONS_SCHEDULER_SECRET}" \
  "https://YOUR-ASTERIA-HOST/api/notifications/tick"
```

Supply the secret securely through the worker's environment/secret store; do not paste it into logs, URLs, source, or a public cron dashboard. Use HTTPS outside localhost. The endpoint accepts POST, not GET; a scheduler offering only GET must call a trusted POST adapter/job. Configure the deployment to allow at least 60 seconds (`maxDuration=60` is exported). Schedule execution independently of browsers/DM traffic, with monitoring and no overlapping local job loops.

Alternatively, the existing gateway's normal mode schedules `/api/discord/tick` every 60 seconds using `x-asteria-secret`; `--dm-only` intentionally schedules no ticks. Its new overlap guard prevents concurrent local ticks. Both endpoint variants share the exact same scheduler lease and queue, so accidental overlap cannot create a second pipeline. A dedicated deployment scheduler is preferable when the gateway machine can sleep or go offline. No live worker configuration was changed during implementation.

Monitor HTTP failures (401 secret/config, 503 schema pending or scheduler failure), plus successful response `errors`, `truncated`, `busy`, `processedOwners`, `created`, `sent`, `skipped`. Watch growing pending/failed queues and stale leases. Missing Discord token leaves the queue untouched and uses no attempt budget. Keep clocks synchronized across worker hosts.

## Verification and manual acceptance

Final results on 2026-10-25:

| Check | Result |
| --- | --- |
| 13 offline test scripts | **237 passed, 0 failed**, including 32 notification tests and 13 Discord bridge/REST/runner tests. |
| `npx prisma validate --config prisma7.config.ts` | Passed; subsequent approved migration deployment also succeeded. |
| `npx tsc --noEmit` | Passed, exit 0. |
| `npm run lint` | Passed, exit 0, no lint findings. |
| `npm run build` | Passed on final retry, exit 0; all 20 pages generated and notification API routes included. |
| `git diff --check` | Passed. |
| Chrome desktop + mobile 390×844 override | Schema-pending bell/Settings UI verified, light/dark, close/Escape/focus return, no horizontal Settings overflow. Viewport/theme restored and test tab closed. |
| `npx prisma migrate deploy --config prisma7.config.ts` | Passed; applied only `20261026_notification_system`. |
| `npx prisma migrate status --config prisma7.config.ts` | Passed; database schema up to date, no pending migrations. |
| `node scripts/check-notification-schema.mjs` | Passed; all 12 applied checksums valid, 12 existing table counts/digests unchanged; notification columns/defaults, ownership/cascade FKs, indexes/checks and RLS/privileges verified. |
| Chrome after migration | Notification preferences enabled, setup-pending message removed, bell shows the real empty inbox without errors. No preference was saved or reminder triggered. |

The installed **Next.js 16.4.0 emitted a known-security-vulnerability upgrade warning**. The final build succeeded with that warning; framework dependencies were not changed as part of the notification implementation. Earlier attempts encountered the framework's security reminder, an intermittent missing generated chunk and sandbox `spawn EPERM`; the final build ran with the necessary local subprocess permission. The successful consolidated tool output is `artifacts/notifications/build-result.txt`; `build.txt` records the earlier sandbox failure. No warning was disabled or framework files modified.

Test command:

```sh
node --test --test-isolation=none scripts/check-notifications.mjs scripts/check-calendar.mjs scripts/check-event-validation.mjs scripts/check-recurrence-rrule.mjs scripts/check-dashboard.mjs scripts/check-productivity-regression.mjs scripts/check-google-oauth.mjs scripts/check-google-import.mjs scripts/check-google-push.mjs scripts/check-prisma-cache.mjs scripts/check-discord.mjs scripts/check-hermes.mjs scripts/check-task-workspace.mjs
```

Offline regression logs and check outputs are under `artifacts/notifications/`. Tests replace Prisma, Supabase and Discord/Gemini/Google calls; no environment or real credentials are loaded by these test scripts. The Node test runner uses `--test-isolation=none` because sandbox subprocess spawning can fail with EPERM; this changes test process isolation, not the tests' external-service mocks.

After migration approval, on an explicitly designated staging/test account:

1. Verify tables/columns, unique indexes, composite owner FK, cascade and deny-by-default grants/RLS. Generate the matching Prisma client and restart the application.
2. Confirm bell, empty state and Settings controls are active; create a test local event 10–15 minutes ahead, a date-only task due tomorrow, an overdue open task, and a daily plan. Invoke the authenticated scheduler once and inspect committed history. Wrong/missing secret and anonymous inbox access must fail.
3. Repeat the tick concurrently: one notification/version and one delivery row/channel; verify bounded ready queue and owner rotation. Re-run unchanged planner generation; change task order and verify one new plan version.
4. Read one/all, dismiss another, refresh and sign out/in; assert state persists and the unread count agrees. Test cross-account IDs and pagination without disclosure.
5. Disable each category/channel, tick again and inspect no new disabled-category notifications and cancellation of queued Discord work. Re-enable to test future reminders rather than replaying cancelled ones.
6. Verify recurring event exception cancellation/move, completed/cancelled tasks, date-only end-of-day across WIB/WITA/WIT/UTC, and all-day date boundaries.
7. With explicit permission to send a test DM, link a test Discord account and verify one actual delivery. Simulate provider faults with staging mocks/proxy; verify backoff/terminal attempts, stale lease recovery and preserved inbox history.
8. Test same-owner replacement and foreign-owner Discord conflict without moving the other account; verify failed unique races retain unused pairing codes.
9. Test desktop/mobile, light/dark, keyboard Tab/Escape, long messages, error/empty/loading states, internal scrolling and relevant resource navigation. Confirm internal Calendar, Google mirrors, To-Do List and Hermes behavior remain intact.

The database migration has been approved, applied and verified. Remaining operational work is deployment/restart as applicable, scheduler secret/job configuration, and authorization to activate/test real notification deliveries. The existing gateway was confirmed in private-DM-only mode with automatic reminders disabled. These live delivery settings were not changed by the migration.

## Full migration SQL (applied with user approval)

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.notification_logs
  ADD COLUMN title VARCHAR(200),
  ADD COLUMN message TEXT,
  ADD COLUMN href VARCHAR(2048),
  ADD COLUMN source_type VARCHAR(24),
  ADD COLUMN source_id TEXT,
  ADD COLUMN source_version VARCHAR(120),
  ADD COLUMN scheduled_at TIMESTAMPTZ(3),
  ADD COLUMN expires_at TIMESTAMPTZ(3),
  ADD COLUMN read_at TIMESTAMPTZ(3),
  ADD COLUMN dismissed_at TIMESTAMPTZ(3),
  ADD COLUMN in_app BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN legacy_discord_sent BOOLEAN NOT NULL DEFAULT true;
-- Existing logs were the old send/dedupe marker. Never replay them on rollout.
ALTER TABLE public.notification_logs ALTER COLUMN legacy_discord_sent SET DEFAULT false;
CREATE UNIQUE INDEX notification_logs_id_owner_unique ON public.notification_logs(id, owner_id);
CREATE INDEX notification_logs_inbox_idx ON public.notification_logs(owner_id, in_app, dismissed_at, read_at, created_at);
CREATE INDEX notification_logs_source_idx ON public.notification_logs(owner_id, source_type, source_version);

CREATE TABLE public.notification_preferences (
  owner_id UUID PRIMARY KEY,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  discord_enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_enabled BOOLEAN NOT NULL DEFAULT true,
  overdue_enabled BOOLEAN NOT NULL DEFAULT true,
  planner_enabled BOOLEAN NOT NULL DEFAULT true,
  event_lead_minutes INTEGER NOT NULL DEFAULT 15 CHECK (event_lead_minutes IN (5,10,15,30,60)),
  deadline_lead_days INTEGER NOT NULL DEFAULT 1 CHECK (deadline_lead_days IN (0,1,2,3,7)),
  morning_hour INTEGER NOT NULL DEFAULT 7 CHECK (morning_hour BETWEEN 0 AND 11),
  overdue_repeat_days INTEGER NOT NULL DEFAULT 1 CHECK (overdue_repeat_days IN (0,1)),
  task_cursor UUID,
  planner_cursor DATE,
  CONSTRAINT notification_preferences_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  channel VARCHAR(24) NOT NULL DEFAULT 'discord',
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retry','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claim_token UUID,
  lease_until TIMESTAMPTZ(3),
  sent_at TIMESTAMPTZ(3),
  last_error VARCHAR(64),
  CONSTRAINT notification_deliveries_notification_owner_fkey FOREIGN KEY (notification_id, owner_id) REFERENCES public.notification_logs(id, owner_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX notification_deliveries_channel_unique ON public.notification_deliveries(notification_id, channel);
CREATE INDEX notification_deliveries_ready_idx ON public.notification_deliveries(channel, status, next_attempt_at, owner_id);
CREATE INDEX notification_deliveries_owner_idx ON public.notification_deliveries(owner_id, status, next_attempt_at);
CREATE TABLE public.notification_scheduler_state (
  key VARCHAR(32) PRIMARY KEY,
  owner_cursor UUID,
  delivery_cursor UUID,
  lease_token UUID,
  lease_until TIMESTAMPTZ(3)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_scheduler_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notification_preferences, public.notification_deliveries,
  public.notification_scheduler_state, public.notification_logs FROM PUBLIC, anon, authenticated;
COMMIT;

```
