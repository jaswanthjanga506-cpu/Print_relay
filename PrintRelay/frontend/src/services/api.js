import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL.replace(/\/$/, '')}/api`,
  withCredentials: true,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (config.method && config.method.toLowerCase() !== 'get') {
    config.headers['X-Requested-With'] = 'PrintRelay';
  }
  return config;
});

api.interceptors.response.use(undefined, (error) => {
  const url = error.config?.url || '';
  if (error.response?.status === 401 && !/^\/auth\/(login|register|me)$/.test(url)) {
    window.dispatchEvent(new CustomEvent('printrelay:session-expired', {
      detail: { message: error.response.data?.error?.message || 'Your session has expired. Please sign in again.' },
    }));
  }
  return Promise.reject(error);
});

export const socketUrl = API_URL.replace(/\/$/, '');
export const payload = (response) => response.data?.data;
export const errorMessage = (error) =>
  error.response?.data?.error?.message
  || (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    ? 'The server took too long to respond. Check that MongoDB Atlas is reachable, then try again.'
    : !error.response
      ? 'Cannot reach the PrintRelay API. Check that the backend is running and try again.'
      : error.message)
  || 'Something went wrong. Please try again.';
