/*
 * M2.6 — read-only security audit against the configured Supabase database.
 * Run: node scripts/check-productivity-security.mjs
 * Reads .env.local. Never inserts, updates, deletes, or migrates data.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is missing from .env.local");

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
const tables = ["profiles", "projects", "tasks", "subtasks", "daily_plan_items"];
const migrations = [
  "20261013_init",
  "20261015_auth_security",
  "20261015_productivity_core",
  "20261019_daily_planner",
];

async function audit() {
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");

    const { rows: security } = await client.query(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls,
             has_table_privilege('anon', c.oid, 'SELECT') AS anon_read,
             has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_read,
             has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
             has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
             has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
             has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
             has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
             has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
             has_table_privilege('anon', c.oid, 'TRUNCATE') AS anon_truncate,
             has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_truncate,
             has_table_privilege('anon', c.oid, 'REFERENCES') AS anon_references,
             has_table_privilege('authenticated', c.oid, 'REFERENCES') AS authenticated_references,
             has_table_privilege('anon', c.oid, 'TRIGGER') AS anon_trigger,
             has_table_privilege('authenticated', c.oid, 'TRIGGER') AS authenticated_trigger
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY($1::text[])
    `, [tables]);

    assert.equal(security.length, tables.length, "One or more Productivity tables are missing");
    for (const row of security) {
      assert.equal(row.rls, true, `${row.table_name}: RLS must be enabled`);
      for (const key of Object.keys(row).filter((k) => k !== "table_name" && k !== "rls")) {
        assert.equal(row[key], false, `${row.table_name}: unexpected ${key} permission`);
      }
      console.log(`PASS  ${row.table_name}: RLS enabled, anon/authenticated have no direct table privileges`);
    }

    const { rows: special } = await client.query(`
      SELECT c.relrowsecurity AS rls,
             has_table_privilege('anon', c.oid, 'SELECT') AS anon_read,
             has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_read,
             has_table_privilege('service_role', c.oid, 'SELECT') AS service_read
      FROM pg_class c
      WHERE c.oid = 'public._prisma_migrations'::regclass
    `);
    assert.equal(special.length, 1);
    assert.equal(special[0].rls, true, "Migration history must have RLS");
    assert.equal(special[0].anon_read, false);
    assert.equal(special[0].authenticated_read, false);
    assert.equal(special[0].service_read, false);
    console.log("PASS  Prisma migration history is restricted");

    const { rows: constraints } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid IN (
        'public.daily_plan_items'::regclass,
        'public.tasks'::regclass,
        'public.subtasks'::regclass,
        'public.profiles'::regclass
      )
    `);
    const find = (name) => constraints.find((row) => row.conname === name);
    assert.ok(find("tasks_id_owner_unique"), "Composite Task ownership uniqueness missing");
    assert.ok(find("daily_plan_task_date_unique"), "Daily plan duplicate prevention missing");
    const fk = find("daily_plan_items_task_id_owner_id_fkey");
    assert.ok(fk, "Planner ownership foreign key missing");
    assert.match(fk.definition, /FOREIGN KEY \(task_id, owner_id\)/i);
    assert.match(fk.definition, /REFERENCES (?:public\.)?tasks\(id, owner_id\)/i);
    assert.match(fk.definition, /ON DELETE CASCADE/i);
    console.log("PASS  Planner ownership FK, uniqueness and cascade are enforced");
    const subtaskFk = find("subtasks_task_id_fkey");
    assert.ok(subtaskFk, "Subtask parent foreign key missing");
    assert.match(subtaskFk.definition, /ON DELETE CASCADE/i);
    const projectFk = find("tasks_project_id_fkey");
    assert.ok(projectFk, "Task project foreign key missing");
    assert.match(projectFk.definition, /ON DELETE SET NULL/i);
    const profileFk = find("profiles_auth_user_fkey");
    assert.ok(profileFk, "Profile/Auth users foreign key missing");
    assert.match(profileFk.definition, /ON DELETE CASCADE/i);
    console.log("PASS  Subtask cascade, Project unlink, and Auth profile FK");

    const { rows: history } = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM public._prisma_migrations
      WHERE migration_name = ANY($1::text[])
    `, [migrations]);
    for (const name of migrations) {
      assert.ok(history.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at),
        `Migration not successfully applied: ${name}`);
    }
    console.log("PASS  All four existing migrations were applied");

    const { rows: mismatches } = await client.query(`
      SELECT count(*)::integer AS total
      FROM public.daily_plan_items AS p
      LEFT JOIN public.tasks AS t ON t.id = p.task_id
      WHERE t.id IS NULL OR t.owner_id <> p.owner_id
    `);
    assert.equal(mismatches[0].total, 0, "Existing Planner rows violate ownership");
    console.log("PASS  No existing cross-user Planner ownership mismatches");

    const { rows: wrongProjects } = await client.query(`
      SELECT count(*)::integer AS total
      FROM public.tasks AS t
      JOIN public.projects AS p ON p.id = t.project_id
      WHERE t.owner_id <> p.owner_id
    `);
    assert.equal(wrongProjects[0].total, 0, "Existing Task/Project ownership mismatch");
    console.log("PASS  No existing cross-user Task/Project assignments");

    await client.query("COMMIT");
    console.log("\nSECURITY AUDIT PASSED (read-only)");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

audit().catch((error) => {
  console.error("SECURITY AUDIT FAILED:", error.message);
  process.exitCode = 1;
});
