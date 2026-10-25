# Contributing to Asteria

Thank you for helping build Asteria, an AI-powered Personal Operating System. Before changing behavior, read [README](README.md), [architecture](docs/architecture.md), and `AGENTS.md`.

## Local workflow

1. Start from the current `main` and create a small, descriptive feature branch.
2. Install with `npm ci`, then configure the required variables using [the setup guide](docs/getting-started.md). Never commit `.env.local`.
3. Keep business logic in `features/` and authenticated entry points in `app/`. Avoid bypassing owner checks in Prisma queries.
4. Add or update focused offline regression checks under `scripts/`.
5. Describe behavior changes, new environment variables, migrations and operational requirements in the relevant docs.
6. Submit changes for review with a clear test report; don't claim external integrations were verified unless real tests were authorized and performed.

## Validate changes

```bash
npx prisma validate --config prisma7.config.ts
npx tsc --noEmit
npm run lint
npm run build
node --test --test-isolation=none scripts/check-notifications.mjs scripts/check-calendar.mjs scripts/check-event-validation.mjs scripts/check-recurrence-rrule.mjs scripts/check-dashboard.mjs scripts/check-productivity-regression.mjs scripts/check-google-oauth.mjs scripts/check-google-import.mjs scripts/check-google-push.mjs scripts/check-prisma-cache.mjs scripts/check-discord.mjs scripts/check-hermes.mjs scripts/check-task-workspace.mjs
```

This repository's checks are primarily Node-based offline suites. There is no confirmed GitHub Actions run in the audited baseline; a passing local test report is not an automated CI guarantee. State which commands ran and what passed or failed.

## Database changes

- Prefer additive migrations; preserve user data and existing notification/delivery history.
- Check unique constraints, composite ownership FKs, RLS, privileges, timeout/locking and rollback behavior.
- `DATABASE_URL` runs server-side Prisma queries; `DIRECT_URL` is used by Prisma migrations. Verify both targets before doing anything destructive.
- **Never run migrations, data backfills or live notification jobs against shared/production resources without approval and a backup.**
- A migration SQL file or successful `prisma validate` does not prove schema deployment.

## Integration changes

- **Google Calendar:** Keep Google imported mirrors read-only and Asteria push events on the dedicated calendar; document any change to permissions or recurrence reconciliation.
- **Discord:** The gateway handles private-DM transport; business logic and authentication belong in the Next.js backend. Never log secret tokens or full private messages.
- **Notifications:** Route new triggers through the shared persistence/delivery pipeline; respect preferences, expiry and idempotency. Tests should not send real messages.
- **Hermes:** Extend tools via validated backend operations and maintain explicit owner boundaries. No direct model-driven SQL or user-supplied owner IDs.

## Code and documentation style

- Follow the existing TypeScript, Tailwind and feature-folder conventions.
- Consult the installed Next.js version's `node_modules/next/dist/docs/` when changing Next.js APIs, as `AGENTS.md` requires.
- Prefer clear, reviewable diffs; avoid unrelated formatting and refactors.
- Do not add secrets, real account screenshots or sensitive build artifacts to Git.
- Clearly label historical milestone notes and any pending deployment step.

## Before proposing a release

Verify a suitable security-fixed Next.js version, schema state for the deployment database, auth/email callback behavior, UI on desktop/mobile, and explicit permission for test Google/Discord calls. Review [the notification rollout checklist](docs/notification-system.md).

