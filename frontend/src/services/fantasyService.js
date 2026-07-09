import api from './apiClient';

export const getMyTeam = (tournamentId) =>
  api.get(`/fantasy/tournaments/${tournamentId}/my-team`).then((r) => r.data.data);

export const createFantasyTeam = (tournamentId, teamName) =>
  api.post('/fantasy/teams', { tournamentId, teamName }).then((r) => r.data.data);

export const getFantasyTeam = (teamId) => api.get(`/fantasy/teams/${teamId}`).then((r) => r.data.data);

export const draftPlayer = (teamId, player) =>
  api.post(`/fantasy/teams/${teamId}/players`, player).then((r) => r.data.data);

export const dropPlayer = (teamId, playerId) =>
  api.delete(`/fantasy/teams/${teamId}/players/${playerId}`).then((r) => r.data.data);

export const setCaptain = (teamId, fantasyPlayerId) =>
  api.patch(`/fantasy/teams/${teamId}/captain`, { fantasyPlayerId }).then((r) => r.data.data);

export const getFantasyLeaderboard = (tournamentId) =>
  api.get(`/fantasy/tournaments/${tournamentId}/leaderboard`).then((r) => r.data.data);
