const express = require('express');
const router = express.Router();

const predictionController = require('../controllers/predictionController');
const commentController = require('../controllers/commentController');
const tournamentController = require('../controllers/tournamentController');
const { protect } = require('../middleware/authMiddleware');

// Match detail (teams, score, status) — used by the standalone match page
router.get('/:matchId', protect, tournamentController.getMatch);

router.get('/:matchId/predictions', protect, predictionController.getMatchPredictions);

// Match trash-talk comments
router.get('/:matchId/comments', protect, commentController.listComments);
router.post('/:matchId/comments', protect, commentController.postComment);
router.delete('/:matchId/comments/:commentId', protect, commentController.deleteComment);

module.exports = router;
