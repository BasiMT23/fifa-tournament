const predictionModel = require('../models/predictionModel');
const tournamentModel = require('../models/tournamentModel');
const { assertPredictable } = require('../services/predictionScoringService');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');

// POST /api/predictions
// Body: { matchId, predictedWinnerId }
const submitPrediction = asyncHandler(async (req, res) => {
  const { matchId, predictedWinnerId } = req.body;
  if (!matchId || !predictedWinnerId) {
    throw new AppError('matchId and predictedWinnerId are required', 400);
  }

  const match = await tournamentModel.getMatchById(matchId);
  assertPredictable(match);

  if (![match.participant1_id, match.participant2_id].includes(predictedWinnerId)) {
    throw new AppError('predictedWinnerId must be one of the two participants in this match', 400);
  }

  const prediction = await predictionModel.upsertPrediction(
    req.user.id,
    match.tournament_id,
    matchId,
    predictedWinnerId
  );

  res.status(201).json({ success: true, data: prediction });
});

// GET /api/tournaments/:id/predictions/me
const getMyPredictions = asyncHandler(async (req, res) => {
  const predictions = await predictionModel.getUserPredictionsForTournament(
    req.user.id,
    req.params.id
  );
  res.json({ success: true, data: predictions });
});

// GET /api/matches/:matchId/predictions
// Privacy rule: other users' picks stay hidden until the match is decided —
// otherwise you could see someone's pick and copy it, or the pick could tip
// off who they think will win before it actually matters.
const getMatchPredictions = asyncHandler(async (req, res) => {
  const match = await tournamentModel.getMatchById(req.params.matchId);
  if (!match) throw new AppError('Match not found', 404);

  const all = await predictionModel.getPredictionsForMatch(match.id);

  if (match.status === 'completed') {
    return res.json({ success: true, data: all });
  }

  // Not completed yet — only the caller's own pick, everyone else's redacted
  const own = all.filter((p) => p.user_id === req.user.id);
  res.json({ success: true, data: own, message: 'Other predictions are hidden until the match completes' });
});

// GET /api/tournaments/:id/leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await predictionModel.getLeaderboard(req.params.id);
  res.json({ success: true, data: leaderboard });
});

module.exports = { submitPrediction, getMyPredictions, getMatchPredictions, getLeaderboard };
