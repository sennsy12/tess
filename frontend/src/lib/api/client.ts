import axios from 'axios';
import { notifyApiError } from '../apiErrors';
import { emitAuthUnauthorized, resetAuthUnauthorized } from '../auth/authEvents';
import { reportEvent } from '../observability';
import {
  AUTH_TOKEN_KEY,
  clearRefreshToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from '../auth/tokenStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/** Auth endpoints whose 401 responses are expected (bad credentials / no session)
 * and must NOT trigger the refresh-or-logout flow. */
const AUTH_ROUTES = new Set(['/auth/login', '/auth/login-kunde', '/auth/verify', '/auth/refresh', '/auth/logout', '/auth/entra', '/auth/entra/config']);

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

// ── Automatic access-token refresh ───────────────────────────────────
// When a request fails with 401 and we hold a refresh token, attempt ONE
// refresh (single-flight: parallel failures share the same promise), then
// replay the original request. Only when the refresh itself fails do we
// emit the global unauthorized event (logout).

let refreshPromise: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    // Raw axios instance — deliberately bypasses this module's interceptors
    // to avoid recursion if the refresh call itself gets a 401.
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { token, refreshToken: nextRefresh } = response.data ?? {};
    if (!token || !nextRefresh) return false;
    setAuthToken(token);
    setRefreshToken(nextRefresh);
    resetAuthUnauthorized();
    return true;
  } catch {
    clearRefreshToken();
    return false;
  } finally {
    refreshPromise = null;
  }
}

function isAuthRoute(url: string): boolean {
  const path = url.startsWith('/') ? url : `/${url}`;
  return AUTH_ROUTES.has(path);
}

// Handle auth + server errors
api.interceptors.response.use(
  (response) => {
    // A successful call means the session is alive again — re-arm the
    // unauthorized latch so a later expiry triggers exactly one logout.
    resetAuthUnauthorized();
    return response;
  },
  async (error) => {
    const status: number | undefined = error.response?.status;
    const config = error.config ?? {};
    const url: string = config.url ?? '';

    if (
      status === 401 &&
      !isAuthRoute(url) &&
      !config._retry && // never replay a replayed request
      getRefreshToken()
    ) {
      try {
        refreshPromise = refreshPromise ?? performRefresh();
        const refreshed = await refreshPromise;
        if (refreshed) {
          config._retry = true;
          return api.request(config);
        }
      } catch {
        // fall through to unauthorized handling
      }
      emitAuthUnauthorized();
    }

    if (!status || status >= 500) {
      notifyApiError({
        message: 'Noe gikk galt ved henting av data. Prøv igjen.',
        status,
        url,
      });
      reportEvent('api_error', { status: status ?? 0, url, method: config.method });
    }
    return Promise.reject(error);
  }
);

export default api;
