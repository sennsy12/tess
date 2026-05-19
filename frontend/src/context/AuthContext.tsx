import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { AUTH_TOKEN_KEY, clearAuthToken, setAuthToken } from '../lib/auth/tokenStore';
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
    clearAuthToken();
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;
    const storedUser = sessionStorage.getItem('user');
    const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    const initAuth = async () => {
      if (storedToken) {
        setAuthToken(storedToken);
        if (isMounted) {
          setToken(storedToken);
        }
      }

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          if (isMounted) {
            setUser(parsedUser);
          }
        } catch {
          sessionStorage.removeItem('user');
        }
      }

      if (storedToken) {
        try {
          const response = await authApi.verify();
          const verifiedUser = response.data?.user as User | undefined;
          if (verifiedUser && isMounted) {
            setUser(verifiedUser);
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
          }
        } catch {
          if (isMounted) {
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

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const { token: newToken, user: newUser } = response.data;

    queryClient.clear();

    setAuthToken(newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const loginKunde = async (kundenr: string, password: string) => {
    const response = await authApi.loginKunde(kundenr, password);
    const { token: newToken, user: newUser } = response.data;

    queryClient.clear();

    setAuthToken(newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        loginKunde,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
