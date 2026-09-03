import api from './client';

export interface AuthResponse {
  token: string;
  /** Opaque refresh token; rotate via authApi.refresh(). Optional for back-compat. */
  refreshToken?: string;
  user: {
    id: number;
    username: string;
    role: 'admin' | 'kunde' | 'analyse';
    kundenr?: string;
  };
}

export interface EntraConfigResponse {
  enabled: boolean;
  clientId?: string;
  tenantId?: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  loginKunde: (kundenr: string, password: string) =>
    api.post<AuthResponse>('/auth/login-kunde', { kundenr, password }),
  verify: () => api.get('/auth/verify'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  /** Exchange a refresh token for a fresh access + refresh pair. */
  refresh: (refreshToken: string) =>
    api.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }),
  /** Revoke a refresh token server-side. Idempotent. */
  logout: (refreshToken: string | null) =>
    api.post('/auth/logout', { refreshToken }),
  /** Public Microsoft sign-in configuration (no secrets). */
  entraConfig: () => api.get<EntraConfigResponse>('/auth/entra/config'),
  /** Exchange a Microsoft ID token for the local token pair. */
  entraLogin: (idToken: string) =>
    api.post<AuthResponse>('/auth/entra', { idToken }),
};
