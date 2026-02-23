import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { clearAuthToken, setAuthToken } from '../lib/auth/tokenStore';
import { onAuthUnauthorized } from '../lib/auth/authEvents';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  loginKunde: (kundenr: string, password: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuthToken();
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
    // Remove all cached queries so next login starts fresh
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;
    const storedUser = sessionStorage.getItem('user');
    const storedToken = sessionStorage.getItem('token');

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
        } catch (error) {
          sessionStorage.removeItem('user');
        }
      }

      try {
        const response = await authApi.verify();
        const verifiedUser = response.data?.user as User | undefined;
        if (verifiedUser && isMounted) {
          setUser(verifiedUser);
          sessionStorage.setItem('user', JSON.stringify(verifiedUser));
        }
      } catch (error) {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

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
    
    // Clear stale data from previous user before setting new state
    queryClient.clear();

    setAuthToken(newToken);
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const loginKunde = async (kundenr: string, password: string) => {
    const response = await authApi.loginKunde(kundenr, password);
    const { token: newToken, user: newUser } = response.data;
    
    // Clear stale data from previous user before setting new state
    queryClient.clear();

    setAuthToken(newToken);
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginKunde, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
