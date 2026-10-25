/* Read-only live schema verification. Never applies a migration or sends messages.
 * --before saves row-count/digest baselines; default verifies the applied schema.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });
const before = process.argv.includes("--before");
const directory = path.resolve("artifacts/notifications");
const baselinePath = path.join(directory, "migration-before.json");
const name = "20261026_notification_system";
const tables = ["notification_logs", "notification_preferences", "notification_deliveries", "notification_scheduler_state"];
const existing = ["profiles", "projects", "tasks", "subtasks", "daily_plan_items", "calendar_events", "google_calendar_connections", "google_calendar_sources", "google_event_mirrors", "discord_connections", "discord_link_codes", "notification_logs"];
const client = new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 15_000, query_timeout: 30_000 });
assert.ok(process.env.DIRECT_URL, "DIRECT_URL is required");

function safeFailure(error) {
  // PostgreSQL connection errors may contain connection details; never print URLs.
  return error instanceof assert.AssertionError ? error.message : `Database verification failed (${error.code ?? error.name ?? "unknown"}).`;
}

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: history } = await client.query("SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at");
  assert.equal(history.filter((row) => !row.finished_at && !row.rolled_back_at).length, 0, "An unfinished migration needs investigation");
  const applied = history.filter((row) => row.finished_at && !row.rolled_back_at);
  for (const migration of applied) {
    const sql = await readFile(path.join("prisma/migrations", migration.migration_name, "migration.sql"), "utf8");
    const variants = [sql, sql.replaceAll("\r\n", "\n"), sql.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n")].map((value) => createHash("sha256").update(value).digest("hex"));
    assert.ok(variants.includes(migration.checksum), `Applied migration checksum differs: ${migration.migration_name}`);
  }
  const snapshot = {};
  for (const table of existing) {
    // Table names come only from the fixed whitelist above. Old log fields are
    // intentionally selected so additive columns cannot change its baseline.
    const value = table === "notification_logs" ? "jsonb_build_object('id', t.id, 'owner_id', t.owner_id, 'kind', t.kind, 'ref_key', t.ref_key, 'created_at', t.created_at)" : table === "profiles" ? "to_jsonb(t) - 'updated_at'" : "to_jsonb(t)";
    const key = ["discord_connections", "google_calendar_connections"].includes(table) ? "owner_id" : table === "discord_link_codes" ? "code" : "id";
    const { rows } = await client.query(`SELECT count(*)::integer AS count, md5(coalesce(string_agg(md5((${value})::text), '' ORDER BY t.${key}), '')) AS digest FROM public.${table} t`);
    snapshot[table] = rows[0];
  }
  const { rows: security } = await client.query(`
    SELECT c.relname AS name, c.relrowsecurity AS rls,
      ARRAY(SELECT role_name || ':' || permission FROM unnest(ARRAY['anon','authenticated']) role_name
        CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) permission
        WHERE has_table_privilege(role_name, c.oid, permission)) AS unexpected_grants
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND c.relkind = 'r'`, [tables]);
  if (before) {
    assert.ok(!history.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at), "Notification migration is already applied; use verification mode");
    assert.equal(security.length, 1, "Unexpected partial notification schema; investigate before deploying");
    assert.equal(security[0].name, "notification_logs");
    await mkdir(directory, { recursive: true });
    await writeFile(baselinePath, JSON.stringify({ recordedAt: new Date().toISOString(), historyCount: history.length, snapshot }, null, 2) + "\n");
    console.log(`PASS preflight: ${applied.length} applied migration checksums valid; ${existing.length} table baselines saved.`);
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    assert.ok(history.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at), "Notification migration is not completed");
    assert.deepEqual(snapshot, baseline.snapshot, "Existing business data changed since preflight; investigate concurrent application activity before proceeding");
    assert.equal(security.length, tables.length, "A notification table is missing");
    for (const table of security) { assert.equal(table.rls, true, `${table.name}: RLS disabled`); assert.deepEqual(table.unexpected_grants, [], `${table.name}: unexpected direct privileges`); }
    const { rows: columns } = await client.query("SELECT column_name, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_logs'");
    for (const column of ["title", "message", "href", "source_type", "source_id", "source_version", "scheduled_at", "expires_at", "read_at", "dismissed_at", "in_app", "legacy_discord_sent"]) assert.ok(columns.some((row) => row.column_name === column), `Missing log column ${column}`);
    assert.equal(columns.find((row) => row.column_name === "legacy_discord_sent").column_default, "false");
    const { rows: legacy } = await client.query("SELECT count(*)::integer AS count FROM public.notification_logs WHERE NOT legacy_discord_sent OR in_app OR title IS NOT NULL");
    assert.equal(legacy[0].count, 0, "Unexpected replay/display flags on legacy logs or concurrent notification generation");
    const { rows: constraints } = await client.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.notification_deliveries'::regclass, 'public.notification_preferences'::regclass)");
    const deliveryFk = constraints.find((row) => row.conname === "notification_deliveries_notification_owner_fkey");
    assert.match(deliveryFk?.definition ?? "", /FOREIGN KEY \(notification_id, owner_id\).*REFERENCES notification_logs\(id, owner_id\).*ON UPDATE CASCADE ON DELETE CASCADE/);
    const ownerFk = constraints.find((row) => row.conname === "notification_preferences_owner_id_fkey");
    assert.match(ownerFk?.definition ?? "", /REFERENCES profiles\(id\).*ON UPDATE CASCADE ON DELETE CASCADE/);
    assert.equal(constraints.filter((row) => /CHECK/.test(row.definition)).length, 6, "Timing/status/attempt check constraints missing");
    const { rows: indexes } = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [tables]);
    for (const index of ["notification_logs_id_owner_unique", "notification_logs_owner_kind_ref_unique", "notification_logs_inbox_idx", "notification_logs_source_idx", "notification_deliveries_channel_unique", "notification_deliveries_ready_idx", "notification_deliveries_owner_idx"]) assert.ok(indexes.some((row) => row.indexname === index), `Missing index ${index}`);
    const result = { verifiedAt: new Date().toISOString(), migration: name, appliedMigrations: history.filter((row) => row.finished_at && !row.rolled_back_at).length, preservedTables: existing, security, checks: ["checksums", "business_data_preserved", "legacy_flags", "columns_defaults", "owner_foreign_keys_cascade", "unique_indexes", "check_constraints", "RLS_privileges"] };
    await writeFile(path.join(directory, "migration-verification.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(`PASS migration: ${name}; all ${result.appliedMigrations} migration checksums valid.`);
    console.log(`PASS data preserved: all ${existing.length} existing table counts/digests unchanged.`);
    console.log("PASS notification tables, columns, defaults, FKs/cascades, indexes, checks, RLS and restricted privileges.");
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(safeFailure(error)); process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
