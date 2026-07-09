const fantasyModel = require('../models/fantasyModel');
const fantasyScoringService = require('../services/fantasyScoringService');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Only the team's owner may modify it — cheap check reused by several handlers below.
const assertOwnsTeam = (team, userId) => {
  if (!team) throw new AppError('Fantasy team not found', 404);
  if (team.user_id !== userId) throw new AppError('You do not own this fantasy team', 403);
};

// POST /api/fantasy/teams
// Body: { tournamentId, teamName }
const createTeam = asyncHandler(async (req, res) => {
  const { tournamentId, teamName } = req.body;
  if (!tournamentId || !teamName) throw new AppError('tournamentId and teamName are required', 400);

  const existing = await fantasyModel.getFantasyTeamByUserTournament(req.user.id, tournamentId);
  if (existing) throw new AppError('You already have a fantasy team for this tournament', 409);

  const team = await fantasyModel.createFantasyTeam(req.user.id, tournamentId, teamName);
  res.status(201).json({ success: true, data: team });
});

// GET /api/fantasy/teams/:id
const getTeam = asyncHandler(async (req, res) => {
  const team = await fantasyModel.getFantasyTeamById(req.params.id);
  if (!team) throw new AppError('Fantasy team not found', 404);

  const players = await fantasyModel.listFantasyPlayers(team.id);
  res.json({ success: true, data: { ...team, players } });
});

// POST /api/fantasy/teams/:id/players
// Body: { externalPlayerId, playerName, position, realTeam, price }
const draftPlayer = asyncHandler(async (req, res) => {
  const team = await fantasyModel.getFantasyTeamById(req.params.id);
  assertOwnsTeam(team, req.user.id);

  const { externalPlayerId, playerName, position, realTeam, price } = req.body;
  if (!externalPlayerId || !playerName || !position || price == null) {
    throw new AppError('externalPlayerId, playerName, position, and price are required', 400);
  }
  if (!fantasyScoringService.VALID_POSITIONS.includes(position)) {
    throw new AppError(`position must be one of ${fantasyScoringService.VALID_POSITIONS.join(', ')}`, 400);
  }

  const { totalCost, squadSize } = await fantasyModel.getSquadCostAndSize(team.id);

  if (squadSize >= fantasyModel.MAX_SQUAD_SIZE) {
    throw new AppError(`Squad is full (max ${fantasyModel.MAX_SQUAD_SIZE} players)`, 400);
  }
  if (totalCost + Number(price) > fantasyModel.BUDGET_CAP) {
    throw new AppError(
      `Drafting this player would exceed your budget cap of ${fantasyModel.BUDGET_CAP} (currently spent: ${totalCost})`,
      400
    );
  }

  const player = await fantasyModel.addFantasyPlayer(team.id, {
    externalPlayerId,
    playerName,
    position,
    realTeam,
    price,
  });
  res.status(201).json({ success: true, data: player });
});

// DELETE /api/fantasy/teams/:id/players/:playerId
const dropPlayer = asyncHandler(async (req, res) => {
  const team = await fantasyModel.getFantasyTeamById(req.params.id);
  assertOwnsTeam(team, req.user.id);

  const removed = await fantasyModel.removeFantasyPlayer(team.id, req.params.playerId);
  if (!removed) throw new AppError('Player not found on this team', 404);
  res.json({ success: true, data: removed });
});

// PATCH /api/fantasy/teams/:id/captain
// Body: { fantasyPlayerId }
const setCaptain = asyncHandler(async (req, res) => {
  const team = await fantasyModel.getFantasyTeamById(req.params.id);
  assertOwnsTeam(team, req.user.id);

  const { fantasyPlayerId } = req.body;
  const player = await fantasyModel.getFantasyPlayerById(fantasyPlayerId);
  if (!player || player.fantasy_team_id !== team.id) {
    throw new AppError('That player is not on your team', 400);
  }

  const captain = await fantasyModel.setCaptain(team.id, fantasyPlayerId);
  res.json({ success: true, data: captain });
});

// POST /api/fantasy/players/:fantasyPlayerId/scoring  (admin/organizer only —
// this is official stat entry, e.g. sourced from a live-scores API in Step 8)
// Body: { gameweek, minutesPlayed, goals, assists, cleanSheet }
const recordGameweekStats = asyncHandler(async (req, res) => {
  const player = await fantasyModel.getFantasyPlayerById(req.params.fantasyPlayerId);
  if (!player) throw new AppError('Fantasy player not found', 404);

  const { gameweek, minutesPlayed, goals, assists, cleanSheet } = req.body;
  if (gameweek == null) throw new AppError('gameweek is required', 400);

  const points = fantasyScoringService.calculatePoints(
    { position: player.position, minutesPlayed, goals, assists, cleanSheet },
    player.is_captain
  );

  const scoring = await fantasyModel.upsertGameweekScoring(
    player.id,
    gameweek,
    { minutesPlayed, goals, assists, cleanSheet },
    points
  );

  const newTotal = await fantasyModel.recalculateTeamTotal(player.fantasy_team_id);

  logger.info(
    `Fantasy scoring: player ${player.id} (${player.player_name}) earned ${points}pts in GW${gameweek}`
  );

  const io = req.app.get('io');
  if (io) {
    io.emit('fantasy:scored', { fantasyTeamId: player.fantasy_team_id, playerId: player.id, points, gameweek });
  }

  res.json({ success: true, data: { scoring, teamTotalPoints: newTotal } });
});

// GET /api/fantasy/teams/:id/gameweek/:gameweek
const getGameweek = asyncHandler(async (req, res) => {
  const rows = await fantasyModel.getGameweekPointsForTeam(req.params.id, req.params.gameweek);
  res.json({ success: true, data: rows });
});

// GET /api/fantasy/tournaments/:tournamentId/my-team
const getMyTeam = asyncHandler(async (req, res) => {
  const team = await fantasyModel.getFantasyTeamByUserTournament(req.user.id, req.params.tournamentId);
  if (!team) return res.json({ success: true, data: null });
  const players = await fantasyModel.listFantasyPlayers(team.id);
  res.json({ success: true, data: { ...team, players } });
});

// GET /api/fantasy/tournaments/:tournamentId/leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await fantasyModel.getLeaderboard(req.params.tournamentId);
  res.json({ success: true, data: leaderboard });
});

module.exports = {
  createTeam,
  getTeam,
  draftPlayer,
  dropPlayer,
  setCaptain,
  recordGameweekStats,
  getGameweek,
  getMyTeam,
  getLeaderboard,
};
