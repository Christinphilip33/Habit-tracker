import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const TOKEN_KEY = 'hf_access_token';
const REFRESH_KEY = 'hf_refresh_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
export function setTokens(access, refresh) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken });
          if (data.access_token) {
            setTokens(data.access_token, null);
            original.headers.Authorization = `Bearer ${data.access_token}`;
            return api(original);
          }
        } catch {
          clearTokens();
        }
      }
    }
    return Promise.reject(error);
  }
);

export function extractError(e) {
  if (!e.response) {
    if (e.code === 'ERR_NETWORK') return 'Network error. Please check your connection.';
    return e.message || 'Something went wrong. Please try again.';
  }
  const data = e.response.data;
  if (data?.detail) {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(e => e?.msg || JSON.stringify(e)).join('. ');
    if (data.detail?.msg) return data.detail.msg;
    return String(data.detail);
  }
  if (data?.message) return data.message;
  if (typeof data === 'string' && data.length < 200) return data;
  return `Error ${e.response.status}: Something went wrong.`;
}

export default api;
