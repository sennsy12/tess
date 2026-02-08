import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  loginKunde: (kundenr: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      
      // Verify token is still valid
      authApi.verify().catch(() => {
        logout();
      });
    }
    
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const { token: newToken, user: newUser } = response.data;
    
    // Clear stale data from previous user before setting new state
    queryClient.clear();

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    setToken(newToken);
    setUser(newUser);
  };

  const loginKunde = async (kundenr: string, password: string) => {
    const response = await authApi.loginKunde(kundenr, password);
    const { token: newToken, user: newUser } = response.data;
    
    // Clear stale data from previous user before setting new state
    queryClient.clear();

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    // Remove all cached queries so next login starts fresh
    queryClient.clear();
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
