const { query, pool } = require('../config/db');

const createTournament = async ({ name, type, organizerId, maxParticipants, startDate, endDate }) => {
  const { rows } = await query(
    `INSERT INTO tournaments (name, type, organizer_id, max_participants, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, type, organizerId, maxParticipants, startDate || null, endDate || null]
  );
  return rows[0];
};

const getTournamentById = async (id) => {
  const { rows } = await query('SELECT * FROM tournaments WHERE id = $1', [id]);
  return rows[0];
};

const listTournaments = async ({ status, type } = {}) => {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM tournaments ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
};

const addParticipant = async (tournamentId, { name, seed, skillRating, groupLabel }) => {
  const { rows } = await query(
    `INSERT INTO tournament_participants (tournament_id, name, seed, skill_rating, group_label)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tournamentId, name, seed, skillRating || 0, groupLabel || null]
  );
  return rows[0];
};

const listParticipants = async (tournamentId) => {
  const { rows } = await query(
    `SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY seed ASC NULLS LAST`,
    [tournamentId]
  );
  return rows;
};

// Inserts all matches for a generated bracket inside a single transaction,
// then wires up next_match_id so round 1 winners auto-advance to round 2, etc.
const persistBracket = async (tournamentId, rounds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // matchIdGrid[roundIndex][matchIndex] = inserted DB id, so we can link rounds afterwards
    const matchIdGrid = [];

    for (let r = 0; r < rounds.length; r++) {
      const roundMatches = rounds[r];
      const idsThisRound = [];
      for (const m of roundMatches) {
        const { rows } = await client.query(
          `INSERT INTO matches
             (tournament_id, round, match_index, participant1_id, participant2_id, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            tournamentId,
            m.round,
            m.matchIndex,
            m.participant1?.id || null,
            m.participant2?.id || null,
            'scheduled',
          ]
        );
        idsThisRound.push(rows[0].id);
      }
      matchIdGrid.push(idsThisRound);
    }

    // Link each match to the one its winner advances to (skip the final round)
    for (let r = 0; r < matchIdGrid.length - 1; r++) {
      for (let i = 0; i < matchIdGrid[r].length; i++) {
        const nextMatchId = matchIdGrid[r + 1][Math.floor(i / 2)];
        await client.query(`UPDATE matches SET next_match_id = $1 WHERE id = $2`, [
          nextMatchId,
          matchIdGrid[r][i],
        ]);
      }
    }

    await client.query('COMMIT');
    return matchIdGrid;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getMatchesByTournament = async (tournamentId) => {
  const { rows } = await query(
    `SELECT m.*,
            p1.name AS participant1_name, p2.name AS participant2_name
     FROM matches m
     LEFT JOIN tournament_participants p1 ON p1.id = m.participant1_id
     LEFT JOIN tournament_participants p2 ON p2.id = m.participant2_id
     WHERE m.tournament_id = $1
     ORDER BY m.round ASC, m.match_index ASC`,
    [tournamentId]
  );
  return rows;
};

const getMatchById = async (id) => {
  const { rows } = await query('SELECT * FROM matches WHERE id = $1', [id]);
  return rows[0];
};

const getMatchByIdWithNames = async (id) => {
  const { rows } = await query(
    `SELECT m.*,
            p1.name AS participant1_name, p2.name AS participant2_name
     FROM matches m
     LEFT JOIN tournament_participants p1 ON p1.id = m.participant1_id
     LEFT JOIN tournament_participants p2 ON p2.id = m.participant2_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0];
};

const updateMatchScore = async (matchId, { score1, score2, winnerId, status }) => {
  const { rows } = await query(
    `UPDATE matches
     SET participant1_score = $1, participant2_score = $2, winner_id = $3,
         status = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [score1, score2, winnerId, status, matchId]
  );
  return rows[0];
};

// Places the winner of one match into the correct slot of its next match
// (slot 1 or 2 depends on whether it was the "top" or "bottom" feeder match).
const advanceWinner = async (currentMatch, winnerId) => {
  if (!currentMatch.next_match_id) return; // final — nobody to advance to

  const nextMatch = await getMatchById(currentMatch.next_match_id);
  // Even match_index feeds into slot 1, odd feeds into slot 2, by construction
  const slot = currentMatch.match_index % 2 === 0 ? 'participant1_id' : 'participant2_id';

  await query(`UPDATE matches SET ${slot} = $1 WHERE id = $2`, [winnerId, nextMatch.id]);
};

module.exports = {
  createTournament,
  getTournamentById,
  listTournaments,
  addParticipant,
  listParticipants,
  persistBracket,
  getMatchesByTournament,
  getMatchById,
  getMatchByIdWithNames,
  updateMatchScore,
  advanceWinner,
};
