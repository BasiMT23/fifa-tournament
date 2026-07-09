const footballDataService = require('../services/footballDataService');
const { asyncHandler } = require('../middleware/errorMiddleware');

// GET /api/external/football-data/competitions/:code/matches?status=&matchday=
const getMatches = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { status, matchday } = req.query;
  const result = await footballDataService.getMatches(code, { status, matchday });
  res.json({ success: true, ...result });
});

// GET /api/external/football-data/competitions/:code/standings
const getStandings = asyncHandler(async (req, res) => {
  const result = await footballDataService.getStandings(req.params.code);
  res.json({ success: true, ...result });
});

// GET /api/external/football-data/teams/:teamId
const getTeamSquad = asyncHandler(async (req, res) => {
  const result = await footballDataService.getTeamSquad(req.params.teamId);
  res.json({ success: true, ...result });
});

// GET /api/external/football-data/competitions/:code/scorers
const getTopScorers = asyncHandler(async (req, res) => {
  const result = await footballDataService.getTopScorers(req.params.code);
  res.json({ success: true, ...result });
});

// GET /api/external/football-data/competitions/:code/teams
const getCompetitionTeams = asyncHandler(async (req, res) => {
  const result = await footballDataService.getCompetitionTeams(req.params.code);
  res.json({ success: true, ...result });
});

module.exports = { getMatches, getStandings, getTeamSquad, getTopScorers, getCompetitionTeams };
