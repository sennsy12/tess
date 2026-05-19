/** Session key — single source of truth (survives Vite HMR module reloads). */
export const AUTH_TOKEN_KEY = 'token';

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
