import api from './apiClient';

export const getCompetitionTeams = (code) =>
  api.get(`/external/football-data/competitions/${code}/teams`).then((r) => r.data.teams);
