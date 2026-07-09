const { query } = require('../config/db');

const createComment = async (matchId, userId, content) => {
  const { rows } = await query(
    `INSERT INTO match_comments (match_id, user_id, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [matchId, userId, content]
  );
  return rows[0];
};

const listComments = async (matchId) => {
  const { rows } = await query(
    `SELECT c.*, u.username, u.avatar_url
     FROM match_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.match_id = $1
     ORDER BY c.created_at ASC`,
    [matchId]
  );
  return rows;
};

const getCommentById = async (id) => {
  const { rows } = await query('SELECT * FROM match_comments WHERE id = $1', [id]);
  return rows[0];
};

const deleteComment = async (id) => {
  const { rows } = await query('DELETE FROM match_comments WHERE id = $1 RETURNING *', [id]);
  return rows[0];
};

module.exports = { createComment, listComments, getCommentById, deleteComment };
