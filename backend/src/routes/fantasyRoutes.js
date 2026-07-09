const express = require('express');
const router = express.Router();

const controller = require('../controllers/fantasyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Team management — any logged-in player can create/manage their own team
router.post('/teams', protect, controller.createTeam);
router.get('/teams/:id', protect, controller.getTeam);
router.post('/teams/:id/players', protect, controller.draftPlayer);
router.delete('/teams/:id/players/:playerId', protect, controller.dropPlayer);
router.patch('/teams/:id/captain', protect, controller.setCaptain);
router.get('/teams/:id/gameweek/:gameweek', protect, controller.getGameweek);

// Official stat entry — restricted, since this determines everyone's points
router.post(
  '/players/:fantasyPlayerId/scoring',
  protect,
  authorize('admin', 'organizer'),
  controller.recordGameweekStats
);

router.get('/tournaments/:tournamentId/my-team', protect, controller.getMyTeam);
router.get('/tournaments/:tournamentId/leaderboard', protect, controller.getLeaderboard);

module.exports = router;
