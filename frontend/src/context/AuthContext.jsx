import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authService from '../services/authService';
import api, { setAccessToken, setUnauthorizedHandler } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we attempt silent refresh on load

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    // On first load there's no access token in memory yet (page refresh wipes it),
    // but the httpOnly refresh cookie might still be valid — try to silently
    // re-authenticate before deciding the user is logged out.
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.data.accessToken);
        const me = await authService.fetchMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { accessToken, user: loggedInUser } = await authService.login({ email, password });
    setAccessToken(accessToken);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (username, email, password) => {
    await authService.register({ username, email, password });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await authService.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
