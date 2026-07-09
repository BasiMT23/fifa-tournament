import axios from 'axios';

// Access token lives in memory only (not localStorage) — safer against XSS,
// since it disappears on a hard refresh. The refresh token is an httpOnly
// cookie the browser sends automatically (see backend authController.js),
// so a hard refresh can silently re-authenticate via /auth/refresh.
let accessToken = null;
let onUnauthorized = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the httpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// If a request fails with 401, try refreshing the access token once and
// replay the original request. If the refresh itself fails, the user is
// logged out (cookie is invalid/expired/revoked).
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh').finally(() => { refreshPromise = null; });
        }
        const { data } = await refreshPromise;
        setAccessToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        onUnauthorized();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
