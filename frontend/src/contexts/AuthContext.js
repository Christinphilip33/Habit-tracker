import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { extractError, setTokens, clearTokens, getToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // null = checking
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    api.get('/api/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { clearTokens(); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      setTokens(data.access_token, data.refresh_token);
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: extractError(e) };
    }
  }, []);

  const register = useCallback(async (email, password, name) => {
    try {
      const { data } = await api.post('/api/auth/register', { email, password, name });
      setTokens(data.access_token, data.refresh_token);
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: extractError(e) };
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    clearTokens();
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
