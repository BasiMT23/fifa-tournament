import api from './apiClient';

export const listTournaments = (params) =>
  api.get('/tournaments', { params }).then((r) => r.data.data);

export const getTournament = (id) => api.get(`/tournaments/${id}`).then((r) => r.data.data);

export const createTournament = (payload) =>
  api.post('/tournaments', payload).then((r) => r.data.data);

export const addParticipants = (tournamentId, participants) =>
  api.post(`/tournaments/${tournamentId}/participants`, { participants }).then((r) => r.data.data);

export const generateBracket = (tournamentId) =>
  api.post(`/tournaments/${tournamentId}/generate-bracket`).then((r) => r.data.data);

export const reportScore = (tournamentId, matchId, score1, score2) =>
  api
    .patch(`/tournaments/${tournamentId}/matches/${matchId}/score`, { score1, score2 })
    .then((r) => r.data);

export const updateMatchStatus = (tournamentId, matchId, status) =>
  api
    .patch(`/tournaments/${tournamentId}/matches/${matchId}/status`, { status })
    .then((r) => r.data.data);

export const getPredictionLeaderboard = (tournamentId) =>
  api.get(`/tournaments/${tournamentId}/leaderboard`).then((r) => r.data.data);
