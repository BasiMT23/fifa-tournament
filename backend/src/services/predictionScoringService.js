const predictionModel = require('../models/predictionModel');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * Points awarded for a correct pick, weighted by round: later rounds are
 * worth more since they require correctly predicting further into the
 * tournament (and depend on earlier picks also having gone your way).
 * Round 1 = 1pt, Round 2 = 2pt, Round 3 = 4pt, Round 4 = 8pt, etc.
 */
const pointsForRound = (round) => Math.pow(2, round - 1);

/**
 * A match can be predicted on only while:
 *  - both participant slots are filled (bracket has to know who's actually playing), and
 *  - the match hasn't started yet (status === 'scheduled').
 * Once an organizer marks it 'live' or 'completed', no new picks or edits.
 */
const assertPredictable = (match) => {
  if (!match) throw new AppError('Match not found', 404);
  if (!match.participant1_id || !match.participant2_id) {
    throw new AppError('Both participants must be known before this match can be predicted', 400);
  }
  if (match.status !== 'scheduled') {
    throw new AppError('Predictions are locked once a match has started', 400);
  }
};

/**
 * Called right after a match is marked completed (see tournamentController.reportScore).
 * Scores every prediction made for that match and persists the points.
 * Returns the list of scored predictions for optional real-time broadcast.
 */
const scorePredictionsForMatch = async (match) => {
  if (!match.winner_id) return []; // draws in round-robin have no winner to score against

  const predictions = await predictionModel.getPredictionsForMatch(match.id);
  const points = pointsForRound(match.round);

  const results = [];
  for (const prediction of predictions) {
    const correct = prediction.predicted_winner_id === match.winner_id;
    const awarded = correct ? points : 0;
    await predictionModel.awardPoints(prediction.id, awarded);
    results.push({ ...prediction, points_awarded: awarded, correct });
  }
  return results;
};

module.exports = { pointsForRound, assertPredictable, scorePredictionsForMatch };
