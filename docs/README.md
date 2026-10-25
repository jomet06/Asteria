# Asteria documentation

Start with the [project README](../README.md) for the product overview and feature status.

## Guides

| Document | Covers |
| --- | --- |
| [Getting started](getting-started.md) | Install, environment variables, Supabase Auth, local development and optional integrations. |
| [Architecture](architecture.md) | Layers, data ownership, Gemini tools, Calendar/Discord, notification pipeline and limitations. |
| [Contributing](../CONTRIBUTING.md) | Development workflow, testing, migrations and contribution boundaries. |
| [Supabase Auth setup](auth-setup.md) | Email confirmation, SMTP, callback configuration and Auth security notes. |
| [Google Calendar two-way integration](google-calendar-two-way.md) | Manual Google import, dedicated-calendar push, recurrence behavior, limitations and recovery. |
| [Notification System](notification-system.md) | Implementation detail, schema audit, scheduler setup, delivery semantics and end-to-end acceptance checklist. |
| [Google import validation](google-import-validation.md) | Historical focused validation and offline test report. |

## Historical milestone notes

- [Internal Calendar M3](calendar-m3.md) — implementation design and **historical** migration state when the milestone report was authored. Its "pending migration" statement is not the latest database status.
- [Google Calendar M3.7.1](../README_M3.7.1.txt) — historical read-only OAuth handoff instructions; later milestones introduced import and outbound pushes.

For the latest *documented* database status, [Notification System](notification-system.md) reports that all 12 migrations, including `20261026_notification_system`, were applied and audited on October 25, 2026. This is an audit record for the environment used in that report, **not** confirmation that every clone/deployment has the same schema.

## Reality checks

- **Implemented in source** does not mean **running in deployment**. Discord DMs need the gateway; notifications need a scheduler; Google sync needs configured credentials and user action.
- The published notification report records 237 passing offline tests and a successful build, but **live provider delivery acceptance remains separate**.
- Future modules (Study Helper, Fitness Tracker, Finance Tracker and Notes) are roadmap entries, not complete shipped systems.
- Security upgrade work for the Next.js version remains open according to the documented build warning.

If you are preparing a release, re-run checks from [Getting started](getting-started.md), verify the target database and external services, and update the dated claims above.

