
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL belum dikonfigurasi di .env.local"
  );
}

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10000,
});

try {
  console.log("Connecting to Supabase PostgreSQL...");

  await client.connect();

  const result = await client.query(`
    SELECT
      current_database() AS database_name,
      current_timestamp AS server_time
  `);

  console.log("Database connected successfully!");
  console.log("Database:", result.rows[0].database_name);
  console.log("Server time:", result.rows[0].server_time);
} catch (error) {
  console.error(
    "Database connection failed:",
    error instanceof Error ? error.message : error
  );

  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
