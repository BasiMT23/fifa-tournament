const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const controller = require('../controllers/externalDataController');
const { protect } = require('../middleware/authMiddleware');

// The free football-data.org plan allows only 10 req/min TOTAL across the
// whole app. Caching (httpClient.js) absorbs most repeat traffic, but this
// limiter is a second line of defense against one user hammering the route
// and starving everyone else's cache-miss requests.
const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests to external data endpoints — please slow down.' },
});

router.use(protect, externalApiLimiter);

router.get('/football-data/competitions/:code/matches', controller.getMatches);
router.get('/football-data/competitions/:code/standings', controller.getStandings);
router.get('/football-data/competitions/:code/scorers', controller.getTopScorers);
router.get('/football-data/teams/:teamId', controller.getTeamSquad);

module.exports = router;
