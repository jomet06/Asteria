// Read-only verification; run after the completion migration is approved/applied.
import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required");
const client = new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query("BEGIN TRANSACTION READ ONLY");
  const { rows: migrations } = await client.query("SELECT finished_at FROM public._prisma_migrations WHERE migration_name = $1 AND rolled_back_at IS NULL", ["20261022_calendar_completion"]);
  assert.ok(migrations.some((row) => row.finished_at), "Calendar completion migration is pending; approval is required before applying it.");
  const { rows } = await client.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.calendar_events'::regclass");
  const constraints = new Map(rows.map((row) => [row.conname, row.definition]));
  for (const [name, pattern] of [
    ["calendar_events_task_owner_fkey", /FOREIGN KEY \(task_id, owner_id\).*REFERENCES tasks\(id, owner_id\).*ON DELETE CASCADE/],
    ["calendar_events_parent_owner_fkey", /FOREIGN KEY \(parent_id, owner_id\).*REFERENCES calendar_events\(id, owner_id\).*ON DELETE CASCADE/],
    ["calendar_events_occurrence_unique", /UNIQUE \(parent_id, original_start\)/],
    ["calendar_events_id_owner_unique", /UNIQUE \(id, owner_id\)/],
    ["calendar_events_exception_shape_chk", /CHECK/],
  ]) assert.match(constraints.get(name) ?? "", pattern, name);
  const { rows: tables } = await client.query("SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.calendar_events'::regclass");
  assert.equal(tables[0].rls, true);
  const { rows: permissions } = await client.query(`SELECT has_table_privilege(role, 'public.calendar_events', privilege) AS allowed FROM unnest(ARRAY['anon','authenticated']) AS role CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS privilege`);
  assert.equal(permissions.length, 14);
  assert.ok(permissions.every((row) => !row.allowed));
  const { rows: invalid } = await client.query(`SELECT count(*)::integer AS total FROM public.calendar_events e LEFT JOIN public.tasks t ON t.id = e.task_id LEFT JOIN public.calendar_events p ON p.id = e.parent_id WHERE (e.task_id IS NOT NULL AND (t.id IS NULL OR t.owner_id <> e.owner_id)) OR (e.parent_id IS NOT NULL AND (p.id IS NULL OR p.owner_id <> e.owner_id))`);
  assert.equal(invalid[0].total, 0);
  await client.query("COMMIT");
  console.log("PASS Completion migration, ownership FKs, exception uniqueness, cascades, RLS, browser permissions and existing ownership integrity");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
