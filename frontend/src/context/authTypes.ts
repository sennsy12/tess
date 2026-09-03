export interface User {
  id: number;
  username: string;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginKunde: (kundenr: string, password: string) => Promise<User>;
  loginEntra: (idToken: string) => Promise<User>;
  logout: () => void;
}
