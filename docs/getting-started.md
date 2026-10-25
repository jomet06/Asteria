# Getting started (development)

This guide covers a **local Asteria web app** and optional integration setup. It is not an instruction to alter an existing live database.

## Prerequisites

- Node.js compatible with Next.js 16, with **Node.js 22+ recommended** if you also run the native-WebSocket Discord gateway.
- npm and a PostgreSQL database in a **Supabase project**, including Supabase Auth and the `auth.users` schema used by Asteria's migrations.
- A development account and permission to create/alter tables **only in the intended environment**.
- Optional: Google OAuth client, Gemini API key, and Discord bot credentials.

## 1. Install

```bash
git clone https://github.com/jomet06/Asteria.git
cd Asteria
npm ci
cp .env.example .env.local
```

Fill in real values in `.env.local`; `.env.example` contains placeholders only. It is ignored by Git, while the example is safe to commit. Do **not** commit access tokens, JWTs, credentials, or real database URLs.

## 2. Configure environment

### Required for the core web app

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for authentication. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon client key; this key is public by design. |
| `NEXT_PUBLIC_SITE_URL` | Application origin, for example `http://localhost:3000`. |
| `DATABASE_URL` | **Server-only** PostgreSQL connection consumed by `lib/prisma.ts`. |
| `DIRECT_URL` | Migration/direct PostgreSQL connection consumed by `prisma7.config.ts`. Verify its target carefully. |

The server's database role needs privileges for Asteria's owner-scoped Prisma queries; browser Supabase roles (`anon`/`authenticated`) are deliberately restricted from the application tables. **Never** put `DATABASE_URL` or `DIRECT_URL` in a `NEXT_PUBLIC_*` variable.

### Optional integrations

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Hermes assistant and AI planner. |
| `GEMINI_MODEL` | Optional model override; current default is `gemini-3.8-flash`. |
| `GEMINI_THINKING_BUDGET` | Optional non-negative integer or `none`; current default is `512`. |
| `GOOGLE_CLIENT_ID` | Google OAuth **Web application** client ID for Calendar, separate from Supabase sign-in. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | Exact callback: `http://localhost:3000/api/integrations/google/callback` for local dev. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | **64 hex characters / 32 bytes** for AES-256-GCM refresh-token encryption. |
| `DISCORD_BOT_TOKEN` | Discord bot token, server/runner only. |
| `DISCORD_INTERNAL_SECRET` | Shared secret between the DM gateway runner and Asteria backend. |
| `ASTERIA_INTERNAL_URL` | Runner's backend base URL; defaults to `http://127.0.0.1:3000`. |
| `NOTIFICATIONS_SCHEDULER_SECRET` | Independent bearer secret for the dedicated notification POST scheduler. |

Generate **new** local secrets securely. For example, create a Calendar token encryption key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep that key stable for an existing database: replacing it will make stored encrypted refresh tokens unreadable without reauthorization.

## 3. Configure Supabase Auth

Configure Supabase's **Site URL** and allowed callback `http://localhost:3000/auth/callback` (plus your actual deployed origin when applicable). Enable email/password or Google sign-in as needed, and configure confirmation-email delivery for public registrations.

Google **sign-in** in Supabase is distinct from Google **Calendar** OAuth. See [Supabase Auth setup](auth-setup.md) for email provider and security notes.

## 4. Inspect schema, then start

Before *any* migration, confirm the correct database target, access, backup, and environment. Inspect existing migration state first:

```bash
npx prisma validate --config prisma7.config.ts
npx prisma migrate status --config prisma7.config.ts
```

On a new or deliberately selected **development** database only, after approval of schema changes:

```bash
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
```

**Do not blindly run `migrate deploy` against production/shared Supabase.** The migration history contains authorization/RLS and notification tables and expects Supabase's `auth.users`. The [notification report](notification-system.md) documents the latest reported applied migration, but your local database may differ.

For an already-migrated database, generate the client and start the app:

```bash
npx prisma generate --config prisma7.config.ts
npm run dev
```

Open `http://localhost:3000`, register or log in, and visit **Dashboard / Tasks / Calendar / Settings**.

## 5. Connect Google Calendar (optional)

1. Configure Google Cloud OAuth consent, the Calendar API, and a **Web application** OAuth client.
2. Add the exact `GOOGLE_REDIRECT_URI` under authorized redirect URIs in Google Cloud.
3. Supply the four Google variables in `.env.local`, restart the app, and connect from **Settings**.
4. Select at most three external calendars and run the manual import. Imported events are read-only in Asteria.
5. Asteria-owned local events can be pushed to its dedicated secondary **Asteria** Google calendar if write scopes are granted. Previous read-only connections may require reconnecting.

Review the [direction table, reconciliation caveats, and retry policy](google-calendar-two-way.md) before relying on Google sync.

## 6. Enable Hermes (optional)

Set `GEMINI_API_KEY` and restart the server. Asteria bot reads bounded task/calendar context and invokes backend-validated tools. AI daily planning is available in the task planner. Model permissions do not bypass application validation.

## 7. Run the Discord gateway (optional)

After configuring `DISCORD_BOT_TOKEN` and `DISCORD_INTERNAL_SECRET`, start a **separate long-running process**:

```bash
npm run bot -- --dm-only
```

This mode handles private DMs and **does not** trigger reminders. To link, open **Settings → Discord**, generate a short-lived code, DM the bot `link CODE`, and wait for confirmation.

Running `npm run bot` (without `--dm-only`) also requests notification ticks every minute via `/api/discord/tick`; this can generate persisted notifications and attempt real Discord sends. Enable it **only** after completing the [notification rollout checklist](notification-system.md). The bot currently handles private messages rather than server/guild channels.

## 8. Notifications and scheduler (optional operational step)

Reading the bell or Settings **does not create reminders**. A trusted scheduler must invoke `POST /api/notifications/tick` every minute using `Authorization: Bearer ...` and the server-only `NOTIFICATIONS_SCHEDULER_SECRET`. The legacy Discord runner can alternatively trigger the same backend pipeline. Prefer a reliable dedicated scheduler independent of browsers or DM activity.

**Do not turn on live delivery by following local setup alone.** First inspect the current environment, migration state, user preferences, and existing queued work. A first tick can generate eligible historical plan/overdue reminders. Use a staging account, get permission for any live DM, and monitor `errors`, `truncated`, `busy` and queue sizes. See [complete operational notes](notification-system.md).

## 9. Verification

```bash
npx prisma validate --config prisma7.config.ts
npx tsc --noEmit
npm run lint
npm run build
node --test --test-isolation=none scripts/check-notifications.mjs scripts/check-calendar.mjs scripts/check-event-validation.mjs scripts/check-recurrence-rrule.mjs scripts/check-dashboard.mjs scripts/check-productivity-regression.mjs scripts/check-google-oauth.mjs scripts/check-google-import.mjs scripts/check-google-push.mjs scripts/check-prisma-cache.mjs scripts/check-discord.mjs scripts/check-hermes.mjs scripts/check-task-workspace.mjs
```

Offline checks mock integrations; they do not prove real Google/Discord delivery or database concurrency. `scripts/check-notification-schema.mjs` is a separate **read-only database check** that requires `DIRECT_URL` and may be appropriate for an explicitly approved verification plan.

## Troubleshooting

- **`DATABASE_URL is not configured`**: check `.env.local` and restart the dev server.
- **Database table or column missing**: check `npx prisma migrate status --config prisma7.config.ts` and regenerate Prisma; do not bypass ownership/RLS.
- **Google connect fails**: check origin, exact redirect URI, OAuth scopes, refresh-token consent, and encryption key.
- **Discord responds but no reminders arrive**: DM runner may be in `--dm-only` mode or scheduler not enabled. Inspect the scheduler and delivery queue before sending tests.
- **Notifications show setup pending**: inspect migration target, generated Prisma client, connection permissions, and schema status.
- **Next.js security warning**: the current pinned version `16.4.0` was reported by the prior build to have a known security warning. Choose a security-fixed compatible upgrade and rerun all checks before public deployment.

