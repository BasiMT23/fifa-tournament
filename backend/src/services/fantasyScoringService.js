// Pure scoring logic — no DB, no I/O — so it can be unit tested in isolation
// and reused wherever points need to be computed (live sync job, manual entry, etc.)

const { AppError } = require('../middleware/errorMiddleware');

const VALID_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// Points per goal, by position — defenders/keepers score less often, so a
// goal from the back is worth more than one from a striker (classic FPL logic).
const GOAL_POINTS = { GK: 6, DEF: 6, MID: 5, FWD: 4 };

// Clean sheet only counts if the player is a keeper/defender/midfielder AND
// played at least 60 minutes (a substitute who came on for 5 minutes
// shouldn't get full credit for a clean sheet they barely contributed to).
const CLEAN_SHEET_POINTS = { GK: 4, DEF: 4, MID: 1, FWD: 0 };

const ASSIST_POINTS = 3;
const MIN_60_POINTS = 2;
const MIN_PLAYED_POINTS = 1; // 1-59 minutes

/**
 * Computes fantasy points for a single player's single-gameweek performance.
 * @param {Object} stats
 * @param {string} stats.position - 'GK' | 'DEF' | 'MID' | 'FWD'
 * @param {number} stats.minutesPlayed
 * @param {number} stats.goals
 * @param {number} stats.assists
 * @param {boolean} stats.cleanSheet
 * @param {boolean} [isCaptain=false] - captain's points count double
 */
const calculatePoints = (stats, isCaptain = false) => {
  const { position, minutesPlayed = 0, goals = 0, assists = 0, cleanSheet = false } = stats;

  if (!VALID_POSITIONS.includes(position)) {
    throw new AppError(`position must be one of ${VALID_POSITIONS.join(', ')}`, 400);
  }

  let points = 0;

  if (minutesPlayed >= 60) points += MIN_60_POINTS;
  else if (minutesPlayed > 0) points += MIN_PLAYED_POINTS;

  points += goals * GOAL_POINTS[position];
  points += assists * ASSIST_POINTS;

  if (cleanSheet && minutesPlayed >= 60) {
    points += CLEAN_SHEET_POINTS[position];
  }

  return isCaptain ? points * 2 : points;
};

module.exports = { calculatePoints, VALID_POSITIONS, GOAL_POINTS, CLEAN_SHEET_POINTS };
