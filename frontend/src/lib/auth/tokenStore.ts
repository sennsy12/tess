/** Session keys — single source of truth (survives Vite HMR module reloads). */
export const AUTH_TOKEN_KEY = 'token';
export const AUTH_USER_KEY = 'user';
export const REFRESH_TOKEN_KEY = 'refreshToken';

export const getAuthToken = (): string | null => {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string | null) => {
  if (typeof sessionStorage === 'undefined') return;
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

export const clearAuthToken = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token: string | null) => {
  if (typeof sessionStorage === 'undefined') return;
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearRefreshToken = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getSessionUser = (): unknown | null => {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupted payload — treat as absent and clean up.
    clearSessionUser();
    return null;
  }
};

export const setSessionUser = (user: unknown) => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearSessionUser = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(AUTH_USER_KEY);
};
