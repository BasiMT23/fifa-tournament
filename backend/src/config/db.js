// Central place for the Postgres connection pool.
// Using a pool (not single client) lets multiple requests query concurrently
// without waiting on each other — important once Socket.io + REST both hit the DB.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                     // max simultaneous connections
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Idle client errors shouldn't crash the whole server
  console.error('Unexpected error on idle Postgres client', err);
});

// Small wrapper so every query goes through one place (useful for logging/debugging later)
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
