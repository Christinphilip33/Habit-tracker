import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send httpOnly cookies with every request
  timeout: 30000,
});

// Auto-refresh on 401 (browser sends refresh_token cookie automatically)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        return api(original);
      } catch {
        // Refresh failed — user needs to log in again
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
