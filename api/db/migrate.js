// ─────────────────────────────────────────────────────────────────────────────
// db/migrate.js  —  Runs the schema.sql against the configured Postgres DB
// Usage:  node db/migrate.js
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'badminton_tournament',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'postgres',
});

async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('❌  schema.sql not found at', schemaPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();

  try {
    console.log('🔄  Running migration …');
    await client.query(sql);
    console.log('✅  Migration complete.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
