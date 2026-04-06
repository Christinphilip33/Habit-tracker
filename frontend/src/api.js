import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Auto-refresh on 401
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
        window.location.href = '/';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.map(e => e?.msg || JSON.stringify(e)).join('. ');
  if (error?.msg) return error.msg;
  if (error?.message) return error.message;
  return String(error);
}

export function extractError(e) {
  // Handle network errors (no response)
  if (!e.response) {
    if (e.code === 'ERR_NETWORK') return 'Network error. Please check your connection.';
    return e.message || 'Something went wrong. Please try again.';
  }
  // Handle API errors with detail field
  const data = e.response.data;
  if (data?.detail) return formatApiError(data.detail);
  if (data?.message) return data.message;
  // Handle raw string responses
  if (typeof data === 'string' && data.length < 200) return data;
  return `Error ${e.response.status}: Something went wrong.`;
}

export default api;
