import axios from 'axios';
import { notifyApiError } from '../apiErrors';
import { emitAuthUnauthorized } from '../auth/authEvents';
import { AUTH_TOKEN_KEY } from '../auth/tokenStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Read token from sessionStorage on every request (avoids stale module state after Vite HMR).
api.interceptors.request.use((config) => {
  if (typeof sessionStorage !== 'undefined') {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/login-kunde') ||
      url.includes('/auth/verify');
    if (error.response?.status === 401 && !isAuthRoute) {
      emitAuthUnauthorized();
    }
    if (!status || status >= 500) {
      notifyApiError({
        message: 'Noe gikk galt ved henting av data. Prøv igjen.',
        status,
        url,
      });
    }
    return Promise.reject(error);
  }
);

export default api;
