import api from './apiClient';

export const listComments = (matchId) => api.get(`/matches/${matchId}/comments`).then((r) => r.data.data);

export const postComment = (matchId, content) =>
  api.post(`/matches/${matchId}/comments`, { content }).then((r) => r.data.data);

export const deleteComment = (matchId, commentId) =>
  api.delete(`/matches/${matchId}/comments/${commentId}`);
