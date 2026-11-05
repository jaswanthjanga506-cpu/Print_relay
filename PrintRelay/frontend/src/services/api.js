import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL.replace(/\/$/, '')}/api`,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (config.method && config.method.toLowerCase() !== 'get') {
    config.headers['X-Requested-With'] = 'PrintRelay';
  }
  return config;
});

export const socketUrl = API_URL.replace(/\/$/, '');
export const payload = (response) => response.data?.data;
export const errorMessage = (error) =>
  error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
