import api from './apiClient';

export const getMatch = (matchId) => api.get(`/matches/${matchId}`).then((r) => r.data.data);
