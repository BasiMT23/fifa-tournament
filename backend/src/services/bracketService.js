// Core bracket-generation logic. Pure functions (no DB calls) so they're easy
// to unit test in isolation — the controller wires them up to the database.

const { AppError } = require('../middleware/errorMiddleware');

/**
 * Returns the next power of two >= n.
 * A 16-team knockout needs 16 slots; a 12-team one still needs 16 slots
 * with 4 "byes" so the bracket stays symmetric.
 */
const nextPowerOfTwo = (n) => Math.pow(2, Math.ceil(Math.log2(n)));

/**
 * Standard tournament seeding order for a bracket of size `size` (power of 2).
 * Produces the classic 1 vs 16, 2 vs 15, ... 8 vs 9 pairing pattern by
 * recursively interleaving seed numbers so top seeds are as spread out as
 * possible and can only meet in later rounds.
 *
 * Returns an array of seed numbers (1-indexed) in bracket-slot order.
 * e.g. for size=8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
const generateSeedOrder = (size) => {
  if (size === 1) return [1];
  const prev = generateSeedOrder(size / 2);
  const result = [];
  prev.forEach((seed) => {
    result.push(seed);
    result.push(size + 1 - seed);
  });
  return result;
};

/**
 * Builds the full bracket structure for a knockout tournament.
 * participants: array of { id, name, skill_rating } already sorted by skill
 *   (highest skill_rating = seed 1). Lower seeds ("byes") get null opponents
 *   and auto-advance in round 1.
 *
 * Returns: { rounds: [ [ {matchIndex, participant1, participant2, round}, ... ], ... ] }
 */
const buildKnockoutBracket = (participants) => {
  if (!participants || participants.length < 2) {
    throw new AppError('Need at least 2 participants to build a bracket', 400);
  }

  const bracketSize = nextPowerOfTwo(participants.length);
  const seedOrder = generateSeedOrder(bracketSize);

  // Map seed number -> participant (or null = "bye" slot)
  const seededSlots = seedOrder.map((seedNum) => participants[seedNum - 1] || null);

  const totalRounds = Math.log2(bracketSize);
  const rounds = [];

  // ---- Round 1: pair up adjacent slots from the seeded order ----
  const round1 = [];
  for (let i = 0; i < seededSlots.length; i += 2) {
    round1.push({
      round: 1,
      matchIndex: i / 2,
      participant1: seededSlots[i],
      participant2: seededSlots[i + 1],
    });
  }
  rounds.push(round1);

  // ---- Subsequent rounds: placeholders, filled in as winners are decided ----
  let matchesInRound = round1.length / 2;
  for (let r = 2; r <= totalRounds; r++) {
    const roundMatches = [];
    for (let i = 0; i < matchesInRound; i++) {
      roundMatches.push({ round: r, matchIndex: i, participant1: null, participant2: null });
    }
    rounds.push(roundMatches);
    matchesInRound = matchesInRound / 2;
  }

  return { rounds, totalRounds };
};

/**
 * Round-robin schedule using the "circle method": fix one participant,
 * rotate the rest each round so everyone plays everyone exactly once.
 * Works for group stages too — call once per group.
 */
const buildRoundRobin = (participants) => {
  const list = [...participants];
  if (list.length % 2 !== 0) list.push(null); // null = "bye" for odd numbers

  const n = list.length;
  const totalRounds = n - 1;
  const half = n / 2;
  const rounds = [];

  let arr = [...list];
  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const p1 = arr[i];
      const p2 = arr[n - 1 - i];
      if (p1 && p2) {
        roundMatches.push({ round: r + 1, matchIndex: i, participant1: p1, participant2: p2 });
      }
    }
    rounds.push(roundMatches);
    // Rotate all but the first element
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  return { rounds, totalRounds };
};

/**
 * Given a completed match's scores, determines the winner participant id.
 * Throws if scores are tied and the sport requires a winner (knockout).
 */
const determineWinner = (match, requireWinner = true) => {
  const { participant1_id, participant2_id, participant1_score, participant2_score } = match;
  if (participant1_score === participant2_score) {
    if (requireWinner) {
      throw new AppError('Knockout matches cannot end in a draw — enter penalty/extra-time result', 400);
    }
    return null; // draw allowed in round-robin
  }
  return participant1_score > participant2_score ? participant1_id : participant2_id;
};

module.exports = {
  nextPowerOfTwo,
  generateSeedOrder,
  buildKnockoutBracket,
  buildRoundRobin,
  determineWinner,
};
