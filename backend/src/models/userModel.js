// "Model" here just means a module of parameterized SQL queries.
// No ORM — keeps it transparent for learning purposes and matches the
// raw-SQL style used elsewhere in your projects (e.g. Folio).

const { query } = require('../config/db');

const createUser = async ({ username, email, passwordHash, role = 'player' }) => {
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role, created_at`,
    [username, email, passwordHash, role]
  );
  return rows[0];
};

const findByEmail = async (email) => {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
};

const findById = async (id) => {
  const { rows } = await query(
    'SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0];
};

const saveRefreshToken = async (userId, tokenHash, expiresAt) => {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

const findValidRefreshToken = async (userId, tokenHash) => {
  const { rows } = await query(
    `SELECT * FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > NOW()`,
    [userId, tokenHash]
  );
  return rows[0];
};

const revokeRefreshToken = async (tokenHash) => {
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  saveRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
};
