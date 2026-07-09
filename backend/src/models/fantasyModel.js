const { query } = require('../config/db');

const BUDGET_CAP = 100.0;
const MAX_SQUAD_SIZE = 15;

const createFantasyTeam = async (userId, tournamentId, teamName) => {
  const { rows } = await query(
    `INSERT INTO fantasy_teams (user_id, tournament_id, team_name)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, tournamentId, teamName]
  );
  return rows[0];
};

const getFantasyTeamById = async (id) => {
  const { rows } = await query('SELECT * FROM fantasy_teams WHERE id = $1', [id]);
  return rows[0];
};

const getFantasyTeamByUserTournament = async (userId, tournamentId) => {
  const { rows } = await query(
    'SELECT * FROM fantasy_teams WHERE user_id = $1 AND tournament_id = $2',
    [userId, tournamentId]
  );
  return rows[0];
};

const listFantasyPlayers = async (teamId) => {
  const { rows } = await query(
    'SELECT * FROM fantasy_players WHERE fantasy_team_id = $1 ORDER BY id ASC',
    [teamId]
  );
  return rows;
};

const getSquadCostAndSize = async (teamId) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(price), 0) AS total_cost, COUNT(*) AS squad_size
     FROM fantasy_players WHERE fantasy_team_id = $1`,
    [teamId]
  );
  return { totalCost: Number(rows[0].total_cost), squadSize: Number(rows[0].squad_size) };
};

const addFantasyPlayer = async (teamId, { externalPlayerId, playerName, position, realTeam, price }) => {
  const { rows } = await query(
    `INSERT INTO fantasy_players
       (fantasy_team_id, external_player_id, player_name, position, real_team, price)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [teamId, externalPlayerId, playerName, position, realTeam, price]
  );
  return rows[0];
};

const removeFantasyPlayer = async (teamId, fantasyPlayerId) => {
  const { rows } = await query(
    'DELETE FROM fantasy_players WHERE id = $1 AND fantasy_team_id = $2 RETURNING *',
    [fantasyPlayerId, teamId]
  );
  return rows[0];
};

// Only one captain per team — clear the flag on every other player first.
const setCaptain = async (teamId, fantasyPlayerId) => {
  await query('UPDATE fantasy_players SET is_captain = FALSE WHERE fantasy_team_id = $1', [teamId]);
  const { rows } = await query(
    `UPDATE fantasy_players SET is_captain = TRUE
     WHERE id = $1 AND fantasy_team_id = $2 RETURNING *`,
    [fantasyPlayerId, teamId]
  );
  return rows[0];
};

const getFantasyPlayerById = async (id) => {
  const { rows } = await query('SELECT * FROM fantasy_players WHERE id = $1', [id]);
  return rows[0];
};

// Upsert this player's stat line for a given gameweek (re-submitting a
// gameweek's stats — e.g. to correct an error — overwrites, doesn't duplicate).
const upsertGameweekScoring = async (fantasyPlayerId, gameweek, stats, points) => {
  const { rows } = await query(
    `INSERT INTO fantasy_scoring
       (fantasy_player_id, gameweek, goals, assists, clean_sheets, minutes_played, points, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (fantasy_player_id, gameweek)
     DO UPDATE SET goals = EXCLUDED.goals, assists = EXCLUDED.assists,
                   clean_sheets = EXCLUDED.clean_sheets, minutes_played = EXCLUDED.minutes_played,
                   points = EXCLUDED.points, computed_at = NOW()
     RETURNING *`,
    [fantasyPlayerId, gameweek, stats.goals || 0, stats.assists || 0, stats.cleanSheet ? 1 : 0, stats.minutesPlayed || 0, points]
  );
  return rows[0];
};

// Recomputes a team's all-time total from every gameweek of every player —
// simple and always-correct, at the cost of a join+sum on every score update.
// Fine at this scale; would move to incremental updates if this got hot.
const recalculateTeamTotal = async (teamId) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(fs.points), 0) AS total
     FROM fantasy_scoring fs
     JOIN fantasy_players fp ON fp.id = fs.fantasy_player_id
     WHERE fp.fantasy_team_id = $1`,
    [teamId]
  );
  const total = Number(rows[0].total);
  await query('UPDATE fantasy_teams SET total_points = $1 WHERE id = $2', [total, teamId]);
  return total;
};

const getGameweekPointsForTeam = async (teamId, gameweek) => {
  const { rows } = await query(
    `SELECT fp.player_name, fp.position, fp.is_captain, fs.*
     FROM fantasy_scoring fs
     JOIN fantasy_players fp ON fp.id = fs.fantasy_player_id
     WHERE fp.fantasy_team_id = $1 AND fs.gameweek = $2`,
    [teamId, gameweek]
  );
  return rows;
};

const getLeaderboard = async (tournamentId) => {
  const { rows } = await query(
    `SELECT ft.id AS team_id, ft.team_name, ft.total_points, u.username
     FROM fantasy_teams ft
     JOIN users u ON u.id = ft.user_id
     WHERE ft.tournament_id = $1
     ORDER BY ft.total_points DESC`,
    [tournamentId]
  );
  return rows;
};

module.exports = {
  BUDGET_CAP,
  MAX_SQUAD_SIZE,
  createFantasyTeam,
  getFantasyTeamById,
  getFantasyTeamByUserTournament,
  listFantasyPlayers,
  getSquadCostAndSize,
  addFantasyPlayer,
  removeFantasyPlayer,
  setCaptain,
  getFantasyPlayerById,
  upsertGameweekScoring,
  recalculateTeamTotal,
  getGameweekPointsForTeam,
  getLeaderboard,
};
