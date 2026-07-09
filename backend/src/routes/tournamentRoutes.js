const express = require('express');
const router = express.Router();

const controller = require('../controllers/tournamentController');
const predictionController = require('../controllers/predictionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, tournamentSchema } = require('../utils/validators');

// Anyone logged in can browse tournaments
router.get('/', protect, controller.listTournaments);
router.get('/:id', protect, controller.getTournament);

// Bracket guessing game — scoped to a tournament
router.get('/:id/predictions/me', protect, predictionController.getMyPredictions);
router.get('/:id/leaderboard', protect, predictionController.getLeaderboard);

// Only organizers/admins can manage tournaments
router.post(
  '/',
  protect,
  authorize('admin', 'organizer'),
  validate(tournamentSchema),
  controller.createTournament
);
router.post(
  '/:id/participants',
  protect,
  authorize('admin', 'organizer'),
  controller.addParticipants
);
router.post(
  '/:id/generate-bracket',
  protect,
  authorize('admin', 'organizer'),
  controller.generateBracket
);
router.patch(
  '/:id/matches/:matchId/status',
  protect,
  authorize('admin', 'organizer'),
  controller.updateMatchStatus
);
router.patch(
  '/:id/matches/:matchId/score',
  protect,
  authorize('admin', 'organizer'),
  controller.reportScore
);

module.exports = router;
