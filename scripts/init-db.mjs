/**
 * Initialize the plain-Postgres schema.
 *
 * Reads database/init.sql and executes it against DATABASE_URL. Idempotent:
 * safe to run repeatedly (everything uses IF NOT EXISTS / CREATE OR REPLACE).
 *
 *   DATABASE_URL=postgres://user:pass@host:5432/db npm run db:init
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'database', 'init.sql');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  console.log('🔌 Connected. Applying database/init.sql ...');
  await client.query(sql);
  console.log('✅ Schema applied successfully.');
} catch (err) {
  console.error('💥 Failed to apply schema:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
