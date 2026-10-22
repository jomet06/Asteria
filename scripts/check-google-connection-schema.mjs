/* M3.7.1 read-only Supabase database audit; requires applied migration. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL missing from .env.local");
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION READ ONLY");
  const { rows: history } = await client.query(`
    SELECT finished_at FROM public._prisma_migrations
    WHERE migration_name = '20261022_google_calendar_connection'
      AND rolled_back_at IS NULL
  `);
  assert.ok(history.some((row) => row.finished_at), "Google Calendar migration is not applied");

  const { rows: table } = await client.query(`
    SELECT c.relrowsecurity AS rls FROM pg_class AS c
    WHERE c.oid = 'public.google_calendar_connections'::regclass
  `);
  assert.equal(table.length, 1);
  assert.equal(table[0].rls, true, "RLS must be enabled");

  const { rows: privileges } = await client.query(`
    SELECT role_name, privilege_name,
      has_table_privilege(role_name, 'public.google_calendar_connections', privilege_name) AS allowed
    FROM unnest(ARRAY['anon', 'authenticated']::text[]) AS roles(role_name)
    CROSS JOIN unnest(ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]::text[]) AS p(privilege_name)
  `);
  assert.equal(privileges.length, 14);
  for (const permission of privileges) {
    assert.equal(permission.allowed, false, `${permission.role_name} has ${permission.privilege_name}`);
  }

  const { rows: constraints } = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.google_calendar_connections'::regclass
  `);
  const names = new Map(constraints.map((row) => [row.conname, row.definition]));
  assert.ok(names.has("google_calendar_connections_pkey"));
  assert.match(names.get("google_calendar_connections_owner_id_fkey") ?? "", /FOREIGN KEY \(owner_id\).*REFERENCES (?:public\.)?profiles\(id\).*ON DELETE CASCADE/i);

  const { rows: columns } = await client.query(`
    SELECT attname AS name, attnotnull AS required
    FROM pg_attribute WHERE attrelid = 'public.google_calendar_connections'::regclass
    AND attnum > 0 AND NOT attisdropped
  `);
  const columnsMap = new Map(columns.map((c) => [c.name, c.required]));
  for (const name of ["owner_id", "google_account_id", "refresh_token_encrypted", "granted_scopes"]) {
    assert.equal(columnsMap.get(name), true, `Missing required column ${name}`);
  }

  await client.query("COMMIT");
  console.log("PASS Google Calendar connection migration, RLS, role permissions, FK cascade and required columns");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("GOOGLE CONNECTION SCHEMA AUDIT FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
