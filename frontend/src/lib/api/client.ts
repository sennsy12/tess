import axios from 'axios';
import { notifyApiError } from '../apiErrors';
import { emitAuthUnauthorized } from '../auth/authEvents';
import { getAuthToken } from '../auth/tokenStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    if (error.response?.status === 401) {
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
