// Integration with football-data.org (v4 REST API, verified against their
// official docs). Free tier: 10 requests/minute, 12 competitions, delayed
// (not live) scores — see https://docs.football-data.org/general/v4/policies.html
//
// Used to pull real fixtures/results that back the fantasy scoring endpoint
// (src/controllers/fantasyController.js) instead of relying on manual entry.

const { axios, cachedRequest } = require('./httpClient');
const { AppError } = require('../middleware/errorMiddleware');

const BASE_URL = 'https://api.football-data.org/v4';

const client = () => {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    throw new AppError('FOOTBALL_DATA_API_KEY is not configured', 500);
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
    timeout: 8000,
  });
};

/**
 * Fixtures/results for a competition (e.g. 'PL' = Premier League, 'CL' = Champions
 * League, 'WC' = World Cup — the 12 codes covered by the free tier).
 * Cached 5 minutes since the free tier's scores are delayed anyway.
 */
const getMatches = async (competitionCode, { status, matchday } = {}) => {
  const params = {};
  if (status) params.status = status; // SCHEDULED | LIVE | FINISHED | ...
  if (matchday) params.matchday = matchday;

  const cacheKey = `fd:matches:${competitionCode}:${status || 'all'}:${matchday || 'all'}`;
  const { data, fromCache, stale } = await cachedRequest(cacheKey, () =>
    client().get(`/competitions/${competitionCode}/matches`, { params })
  );
  return { matches: data.matches, fromCache, stale };
};

/** League table for a competition. */
const getStandings = async (competitionCode) => {
  const cacheKey = `fd:standings:${competitionCode}`;
  const { data, fromCache } = await cachedRequest(cacheKey, () =>
    client().get(`/competitions/${competitionCode}/standings`)
  );
  return { standings: data.standings, fromCache };
};

/** Squad list for a team — useful when populating fantasy draft pools. */
const getTeamSquad = async (teamId) => {
  const cacheKey = `fd:team:${teamId}`;
  const { data, fromCache } = await cachedRequest(
    cacheKey,
    () => client().get(`/teams/${teamId}`),
    3600 // squads change rarely — cache an hour
  );
  return { team: data, fromCache };
};

/** Top scorers for a competition — handy seed data for fantasy player pools. */
const getTopScorers = async (competitionCode) => {
  const cacheKey = `fd:scorers:${competitionCode}`;
  const { data, fromCache } = await cachedRequest(cacheKey, () =>
    client().get(`/competitions/${competitionCode}/scorers`)
  );
  return { scorers: data.scorers, fromCache };
};

module.exports = { getMatches, getStandings, getTeamSquad, getTopScorers };
