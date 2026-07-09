import api from './apiClient';

export const register = (payload) => api.post('/auth/register', payload).then((r) => r.data.data);
export const login = (payload) => api.post('/auth/login', payload).then((r) => r.data.data);
export const logout = () => api.post('/auth/logout');
export const fetchMe = () => api.get('/auth/me').then((r) => r.data.data);
