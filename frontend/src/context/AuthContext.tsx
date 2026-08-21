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
  setAuthToken,
  setRefreshToken,
  setSessionUser,
} from '../lib/auth/tokenStore';
import { onAuthUnauthorized } from '../lib/auth/authEvents';
import { AuthContext } from './authContextInstance';
import type { User } from './authTypes';

export type { User } from './authTypes';

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
    clearAuthToken();
    clearRefreshToken();
    clearSessionUser();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;
    const storedUser = getSessionUser() as User | null;
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
        try {
          const response = await authApi.verify();
          const verifiedUser = response.data?.user as User | undefined;
          const tokenUnchanged =
            isMounted && sessionStorage.getItem(AUTH_TOKEN_KEY) === tokenAtStart;
          if (verifiedUser && tokenUnchanged) {
            setUser(verifiedUser);
            setSessionUser(verifiedUser);
          }
        } catch {
          // Only log out if the session was not replaced while we awaited.
          if (isMounted && sessionStorage.getItem(AUTH_TOKEN_KEY) === tokenAtStart) {
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

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      loginKunde,
      logout,
    }),
    [user, token, isLoading, isAuthenticated, login, loginKunde, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
