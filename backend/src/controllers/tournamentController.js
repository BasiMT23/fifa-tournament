const tournamentModel = require('../models/tournamentModel');
const bracketService = require('../services/bracketService');
const predictionScoringService = require('../services/predictionScoringService');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// POST /api/tournaments  (organizer/admin only)
const createTournament = asyncHandler(async (req, res) => {
  const { name, type, max_participants, start_date, end_date } = req.body;
  const tournament = await tournamentModel.createTournament({
    name,
    type,
    organizerId: req.user.id,
    maxParticipants: max_participants,
    startDate: start_date,
    endDate: end_date,
  });
  res.status(201).json({ success: true, data: tournament });
});

// GET /api/tournaments
const listTournaments = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  const tournaments = await tournamentModel.listTournaments({ status, type });
  res.json({ success: true, data: tournaments });
});

// GET /api/tournaments/:id
const getTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getTournamentById(req.params.id);
  if (!tournament) throw new AppError('Tournament not found', 404);

  const participants = await tournamentModel.listParticipants(tournament.id);
  const matches = await tournamentModel.getMatchesByTournament(tournament.id);

  res.json({ success: true, data: { ...tournament, participants, matches } });
});

// POST /api/tournaments/:id/participants  (bulk add, organizer/admin only)
// Body: { participants: [{ name, skillRating }, ...] }
const addParticipants = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getTournamentById(req.params.id);
  if (!tournament) throw new AppError('Tournament not found', 404);
  if (tournament.status !== 'draft') {
    throw new AppError('Cannot add participants once the tournament has started', 400);
  }

  const { participants } = req.body;
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new AppError('participants must be a non-empty array', 400);
  }

  // Rank by skill rating (descending) to assign seeds — highest rated = seed 1.
  const ranked = [...participants].sort((a, b) => (b.skillRating || 0) - (a.skillRating || 0));

  const created = [];
  for (let i = 0; i < ranked.length; i++) {
    const p = await tournamentModel.addParticipant(tournament.id, {
      name: ranked[i].name,
      seed: i + 1,
      skillRating: ranked[i].skillRating,
      groupLabel: ranked[i].groupLabel,
    });
    created.push(p);
  }

  res.status(201).json({ success: true, data: created });
});

// POST /api/tournaments/:id/generate-bracket  (organizer/admin only)
const generateBracket = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getTournamentById(req.params.id);
  if (!tournament) throw new AppError('Tournament not found', 404);

  const participants = await tournamentModel.listParticipants(tournament.id);
  if (participants.length < 2) {
    throw new AppError('Need at least 2 participants before generating a bracket', 400);
  }

  let rounds;
  if (tournament.type === 'knockout') {
    ({ rounds } = bracketService.buildKnockoutBracket(participants));
  } else if (tournament.type === 'round_robin') {
    ({ rounds } = bracketService.buildRoundRobin(participants));
  } else {
    // group_knockout: for brevity, generate round-robin per group here;
    // the knockout stage gets generated separately once group play concludes
    // (grouping participants by group_label, one buildRoundRobin call per group).
    const groups = {};
    participants.forEach((p) => {
      const g = p.group_label || 'A';
      groups[g] = groups[g] || [];
      groups[g].push(p);
    });
    rounds = Object.values(groups).flatMap((g) => bracketService.buildRoundRobin(g).rounds);
  }

  await tournamentModel.persistBracket(tournament.id, rounds);

  // Mark tournament as in progress now that the bracket exists
  await require('../config/db').query(
    `UPDATE tournaments SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
    [tournament.id]
  );

  const matches = await tournamentModel.getMatchesByTournament(tournament.id);
  logger.info(`Bracket generated for tournament ${tournament.id} (${matches.length} matches)`);

  const io = req.app.get('io');
  if (io) {
    io.to(`tournament:${tournament.id}`).emit('bracket:generated', { tournamentId: tournament.id, matches });
  }

  res.status(201).json({ success: true, data: matches });
});

// GET /api/tournaments/:id/matches/:matchId
const getMatch = asyncHandler(async (req, res) => {
  const match = await tournamentModel.getMatchByIdWithNames(req.params.matchId);
  if (!match) throw new AppError('Match not found', 404);
  res.json({ success: true, data: match });
});

// PATCH /api/tournaments/:id/matches/:matchId/status  (organizer/admin only)
// Body: { status } — e.g. move a match to 'live' right before/as it kicks off.
// Separate from reportScore because "this match just started" and "this match
// just finished with a score" are different real-time events for spectators.
const updateMatchStatus = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  const { status } = req.body;
  const validStatuses = ['scheduled', 'live', 'completed', 'postponed'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`status must be one of ${validStatuses.join(', ')}`, 400);
  }

  const match = await tournamentModel.getMatchById(matchId);
  if (!match) throw new AppError('Match not found', 404);

  const updated = await tournamentModel.updateMatchScore(matchId, {
    score1: match.participant1_score,
    score2: match.participant2_score,
    winnerId: match.winner_id,
    status,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`tournament:${match.tournament_id}`).emit('match:status_changed', updated);
  }

  res.json({ success: true, data: updated });
});

// PATCH /api/tournaments/:id/matches/:matchId/score  (organizer/admin only)
// Body: { score1, score2 }
const reportScore = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  const { score1, score2 } = req.body;

  const match = await tournamentModel.getMatchById(matchId);
  if (!match) throw new AppError('Match not found', 404);
  if (!match.participant1_id || !match.participant2_id) {
    throw new AppError('Both participants must be set before reporting a score', 400);
  }

  const winnerId = bracketService.determineWinner(
    { ...match, participant1_score: score1, participant2_score: score2 },
    true // knockout requires a winner; pass false for round-robin draws
  );

  const updated = await tournamentModel.updateMatchScore(matchId, {
    score1,
    score2,
    winnerId,
    status: 'completed',
  });

  await tournamentModel.advanceWinner(match, winnerId);

  // Grade every prediction made for this match now that the winner is known.
  const scoredPredictions = await predictionScoringService.scorePredictionsForMatch(updated);

  // Real-time push
  const io = req.app.get('io');
  if (io) {
    io.to(`tournament:${match.tournament_id}`).emit('match:completed', updated);
    io.to(`tournament:${match.tournament_id}`).emit('predictions:scored', scoredPredictions);

    // If the winner advanced into a next-round match, push that match's new
    // state too — this is the "bracket auto-updates" real-time feature.
    if (match.next_match_id) {
      const nextMatch = await tournamentModel.getMatchById(match.next_match_id);
      io.to(`tournament:${match.tournament_id}`).emit('bracket:match_advanced', nextMatch);
    }
  }

  res.json({ success: true, data: updated, predictionsScored: scoredPredictions.length });
});

module.exports = {
  createTournament,
  listTournaments,
  getTournament,
  addParticipants,
  generateBracket,
  getMatch,
  updateMatchStatus,
  reportScore,
};
