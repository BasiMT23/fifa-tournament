const { query } = require('../config/db');

// Upsert: a user can change their pick right up until the match locks
// (enforced in the controller, not here) — ON CONFLICT keeps this atomic.
const upsertPrediction = async (userId, tournamentId, matchId, predictedWinnerId) => {
  const { rows } = await query(
    `INSERT INTO predictions (user_id, tournament_id, match_id, predicted_winner_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, match_id)
     DO UPDATE SET predicted_winner_id = EXCLUDED.predicted_winner_id
     RETURNING *`,
    [userId, tournamentId, matchId, predictedWinnerId]
  );
  return rows[0];
};

const getUserPrediction = async (userId, matchId) => {
  const { rows } = await query(
    'SELECT * FROM predictions WHERE user_id = $1 AND match_id = $2',
    [userId, matchId]
  );
  return rows[0];
};

// All predictions for a match, with usernames — caller decides whether
// it's safe to expose this yet (see predictionController.getMatchPredictions).
const getPredictionsForMatch = async (matchId) => {
  const { rows } = await query(
    `SELECT p.*, u.username
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.match_id = $1
     ORDER BY p.created_at ASC`,
    [matchId]
  );
  return rows;
};

const getUserPredictionsForTournament = async (userId, tournamentId) => {
  const { rows } = await query(
    `SELECT p.*, m.round, m.match_index, m.status AS match_status,
            m.winner_id, m.participant1_id, m.participant2_id
     FROM predictions p
     JOIN matches m ON m.id = p.match_id
     WHERE p.user_id = $1 AND p.tournament_id = $2
     ORDER BY m.round ASC, m.match_index ASC`,
    [userId, tournamentId]
  );
  return rows;
};

const awardPoints = async (predictionId, points) => {
  await query('UPDATE predictions SET points_awarded = $1 WHERE id = $2', [points, predictionId]);
};

// Leaderboard scoped to a single tournament (the global `prediction_leaderboard`
// view in schema.sql covers all-time stats; this is the per-tournament version).
const getLeaderboard = async (tournamentId) => {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.username,
            COALESCE(SUM(p.points_awarded), 0) AS total_points,
            COUNT(p.id) FILTER (WHERE p.points_awarded > 0) AS correct_picks,
            COUNT(p.id) AS total_picks
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.tournament_id = $1
     GROUP BY u.id, u.username
     ORDER BY total_points DESC, correct_picks DESC`,
    [tournamentId]
  );
  return rows;
};

module.exports = {
  upsertPrediction,
  getUserPrediction,
  getPredictionsForMatch,
  getUserPredictionsForTournament,
  awardPoints,
  getLeaderboard,
};
