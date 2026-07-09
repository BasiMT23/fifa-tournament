import api from './apiClient';

export const submitPrediction = (matchId, predictedWinnerId) =>
  api.post('/predictions', { matchId, predictedWinnerId }).then((r) => r.data.data);

export const getMyPredictions = (tournamentId) =>
  api.get(`/tournaments/${tournamentId}/predictions/me`).then((r) => r.data.data);

export const getMatchPredictions = (matchId) =>
  api.get(`/matches/${matchId}/predictions`).then((r) => r.data);
