export type UserRole = 'admin' | 'kunde' | 'analyse';

export interface UserPublic {
  id: number;
  username: string;
  role: UserRole;
  kundenr: string | null;
  created_at: string;
}

export interface CreateUserPayload {
  username: string;
  password?: string;
  role: UserRole | string;
  kundenr?: string;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: UserRole | string;
  kundenr?: string | null;
  actionKey?: string;
}
