// Run with: npm run migrate
// Applies schema.sql directly. For a real production app you'd eventually
// switch to versioned migrations (node-pg-migrate / Knex), but for a course
// project a single idempotent schema file is simpler to reason about.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await pool.query(sql);
  console.log('Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
