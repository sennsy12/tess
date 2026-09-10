import { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import {
  AUTH_TOKEN_KEY,
  clearAuthToken,
  clearRefreshToken,
  clearSessionUser,
  getRefreshToken,
  getSessionUser,
  isSessionUser,
  setAuthToken,
  setRefreshToken,
  setSessionUser,
} from '../lib/auth/tokenStore';
import { onAuthUnauthorized } from '../lib/auth/authEvents';
import { AuthContext } from './authContextInstance';
import type { User } from './authTypes';

export type { User } from './authTypes';

/** Single explicit refresh for boot path (client.ts excludes /auth/verify). */
async function tryRefreshOnce(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await authApi.refresh(refreshToken);
    const next = res.data as { token?: string; refreshToken?: string };
    if (!next?.token || !next?.refreshToken) {
      clearRefreshToken();
      return false;
    }
    setAuthToken(next.token);
    setRefreshToken(next.refreshToken);
    return true;
  } catch {
    clearRefreshToken();
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    // Best-effort server-side revocation of the refresh token; local state
    // is cleared regardless so the UI never depends on the network call.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void authApi.logout(refreshToken).catch(() => undefined);
    }
    // Best-effort Microsoft sign-out (hybrid auth); never blocks local logout.
    // Imported on demand: a static import here would pull @azure/msal-browser
    // into the entry chunk for every user, including the (default) majority
    // who never sign in with Microsoft.
    void import('../lib/auth/msalClient')
      .then((mod) => mod.logoutMicrosoft())
      .catch(() => undefined);
    clearAuthToken();
    clearRefreshToken();
    clearSessionUser();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;
    const rawStoredUser = getSessionUser();
    const storedUser = isSessionUser(rawStoredUser) ? rawStoredUser : null;
    if (rawStoredUser && !storedUser) {
      // Corrupted session payload — drop it rather than trusting the shape.
      clearSessionUser();
    }
    const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    const initAuth = async () => {
      if (storedToken) {
        setAuthToken(storedToken);
        if (isMounted) {
          setToken(storedToken);
        }
      }

      if (storedUser) {
        if (isMounted) {
          setUser(storedUser);
        }
      }

      if (storedToken) {
        // Capture the token before awaiting so that if the session was
        // invalidated while the request was in flight (401 in another tab /
        // another request, or the user logged in again), we do not
        // resurrect stale auth state afterwards.
        const tokenAtStart = storedToken;
        const stillCurrent = () =>
          isMounted && sessionStorage.getItem(AUTH_TOKEN_KEY) === tokenAtStart;

        const applyVerifiedUser = async (): Promise<boolean> => {
          try {
            const response = await authApi.verify();
            const verifiedUser = isSessionUser(response.data?.user as unknown)
              ? (response.data.user as User)
              : undefined;
            if (verifiedUser && stillCurrent()) {
              setUser(verifiedUser);
              setSessionUser(verifiedUser);
              return true;
            }
            return false;
          } catch {
            return false;
          }
        };

        const ok = await applyVerifiedUser();
        if (!ok && stillCurrent()) {
          // /auth/verify is excluded from auto-refresh in client.ts, so an
          // expired access token + valid refresh token would otherwise log
          // out needlessly. Try one refresh, then re-verify once.
          const refreshed = await tryRefreshOnce();
          if (refreshed && stillCurrent()) {
            const retryOk = await applyVerifiedUser();
            if (!retryOk && stillCurrent()) {
              logout();
            } else if (stillCurrent()) {
              // Refresh rotated the access token — sync React state.
              const current = sessionStorage.getItem(AUTH_TOKEN_KEY);
              if (current) setToken(current);
            }
          } else if (stillCurrent()) {
            logout();
          }
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    void initAuth();

    const unsubscribe = onAuthUnauthorized(() => {
      if (isMounted) {
        logout();
        navigate('/login', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [logout, navigate]);

  const authenticate = useCallback(
    async (
      request: () => Promise<{ data: { token: string; refreshToken?: string; user: User } }>
    ): Promise<User> => {
      const response = await request();
      const { token: newToken, refreshToken: newRefreshToken, user: newUser } = response.data;

      queryClient.clear();

      setAuthToken(newToken);
      setRefreshToken(newRefreshToken ?? null);
      setSessionUser(newUser);
      setToken(newToken);
      setUser(newUser);
      return newUser;
    },
    [queryClient]
  );

  const login = useCallback(
    (username: string, password: string) =>
      authenticate(() => authApi.login(username, password)),
    [authenticate]
  );

  const loginKunde = useCallback(
    (kundenr: string, password: string) =>
      authenticate(() => authApi.loginKunde(kundenr, password)),
    [authenticate]
  );

  const loginEntra = useCallback(
    (idToken: string) => authenticate(() => authApi.entraLogin(idToken)),
    [authenticate]
  );

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      loginKunde,
      loginEntra,
      logout,
    }),
    [user, token, isLoading, isAuthenticated, login, loginKunde, loginEntra, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
