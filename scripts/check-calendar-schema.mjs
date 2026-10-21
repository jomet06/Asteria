
/*
 * M3.1 — Calendar Database Verification
 *
 * Run:
 * node scripts/check-calendar-schema.mjs
 *
 * Uses DIRECT_URL from .env.local.
 * Never creates, modifies, or deletes database data.
 */

import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL is missing from .env.local"
  );
}

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 10000,
});

async function verifyCalendarSchema() {
  await client.connect();

  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    // ====================================
    // 1. TABLE AND RLS
    // ====================================

    const { rows: tables } = await client.query(`
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled
      FROM pg_class AS c
      JOIN pg_namespace AS n
        ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'calendar_events'
        AND c.relkind = 'r'
    `);

    assert.equal(
      tables.length,
      1,
      "calendar_events table is missing"
    );

    assert.equal(
      tables[0].rls_enabled,
      true,
      "RLS is not enabled"
    );

    console.log("PASS Calendar table and RLS");

    // ====================================
    // 2. TABLE PERMISSIONS
    // ====================================

    const { rows: permissions } =
      await client.query(`
        SELECT
          role_name,
          permission_name,
          has_table_privilege(
            role_name,
            'public.calendar_events',
            permission_name
          ) AS allowed
        FROM unnest(
          ARRAY['anon', 'authenticated']::text[]
        ) AS roles(role_name)
        CROSS JOIN unnest(
          ARRAY[
            'SELECT',
            'INSERT',
            'UPDATE',
            'DELETE',
            'TRUNCATE',
            'REFERENCES',
            'TRIGGER'
          ]::text[]
        ) AS privileges(permission_name)
      `);

    assert.equal(permissions.length, 14);

    for (const permission of permissions) {
      assert.equal(
        permission.allowed,
        false,
        `${permission.role_name} unexpectedly has ${permission.permission_name}`
      );
    }

    console.log("PASS Direct browser-role permissions");

    // ====================================
    // 3. REQUIRED COLUMNS
    // ====================================

    const { rows: columns } =
      await client.query(`
        SELECT
          a.attname AS column_name,
          format_type(
            a.atttypid,
            a.atttypmod
          ) AS type_name,
          a.attnotnull AS required
        FROM pg_attribute AS a
        WHERE a.attrelid =
          'public.calendar_events'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
      `);

    const columnMap = new Map(
      columns.map((column) => [
        column.column_name,
        column,
      ])
    );

    const requiredColumns = [
      "id",
      "owner_id",
      "title",
      "starts_at",
      "ends_at",
      "timezone",
      "is_all_day",
      "created_at",
      "updated_at",
    ];

    for (const name of requiredColumns) {
      const column = columnMap.get(name);

      assert.ok(
        column,
        `Missing required column: ${name}`
      );

      assert.equal(
        column.required,
        true,
        `${name} must be NOT NULL`
      );
    }

    for (const name of [
      "description",
      "location",
      "recurrence_rule",
    ]) {
      const column = columnMap.get(name);

      assert.ok(column, `Missing column: ${name}`);

      assert.equal(
        column.required,
        false,
        `${name} should be nullable`
      );
    }

    for (const name of [
      "starts_at",
      "ends_at",
    ]) {
      assert.match(
        columnMap.get(name).type_name,
        /with time zone/i,
        `${name} must use TIMESTAMPTZ`
      );
    }

    console.log("PASS Calendar columns and timestamps");

    // ====================================
    // 4. CONSTRAINTS
    // ====================================

    const { rows: constraints } =
      await client.query(`
        SELECT
          conname,
          pg_get_constraintdef(oid)
            AS definition
        FROM pg_constraint
        WHERE conrelid =
          'public.calendar_events'::regclass
      `);

    const constraintMap = new Map(
      constraints.map((row) => [
        row.conname,
        row.definition,
      ])
    );

    const ownerForeignKey = constraintMap.get(
      "calendar_events_owner_id_fkey"
    );

    assert.ok(
      ownerForeignKey,
      "Calendar owner foreign key is missing"
    );

    assert.match(
      ownerForeignKey,
      /FOREIGN KEY \(owner_id\)/i
    );

    assert.match(
      ownerForeignKey,
      /ON DELETE CASCADE/i
    );

    for (const name of [
      "calendar_events_pkey",
      "calendar_events_time_range_chk",
      "calendar_events_title_nonblank_chk",
      "calendar_events_timezone_nonblank_chk",
    ]) {
      assert.ok(
        constraintMap.has(name),
        `Missing constraint: ${name}`
      );
    }

    console.log("PASS Foreign key and constraints");

    // ====================================
    // 5. INDEXES
    // ====================================

    const { rows: indexes } =
      await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'calendar_events'
      `);

    const indexNames = new Set(
      indexes.map((index) => index.indexname)
    );

    for (const name of [
      "calendar_events_owner_starts_idx",
      "calendar_events_owner_ends_idx",
    ]) {
      assert.ok(
        indexNames.has(name),
        `Missing index: ${name}`
      );
    }

    console.log("PASS Calendar query indexes");

    // ====================================
    // 6. MIGRATION STATUS
    // ====================================

    const { rows: history } =
      await client.query(`
        SELECT
          finished_at,
          rolled_back_at
        FROM public._prisma_migrations
        WHERE migration_name =
          '20261021_calendar_events'
      `);

    assert.ok(
      history.some(
        (row) =>
          row.finished_at !== null &&
          row.rolled_back_at === null
      ),
      "Calendar migration was not applied successfully"
    );

    console.log("PASS Calendar migration history");

    // ====================================
    // 7. INVALID EXISTING ROWS
    // ====================================

    const { rows: invalidRows } =
      await client.query(`
        SELECT count(*)::integer AS total
        FROM public.calendar_events
        WHERE ends_at <= starts_at
      `);

    assert.equal(
      invalidRows[0].total,
      0,
      "Calendar contains invalid time ranges"
    );

    console.log("PASS Event time range integrity");

    await client.query("COMMIT");

    console.log(
      "\nCALENDAR DATABASE VERIFICATION PASSED"
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

verifyCalendarSchema().catch((error) => {
  console.error(
    "CALENDAR VERIFICATION FAILED:",
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});
