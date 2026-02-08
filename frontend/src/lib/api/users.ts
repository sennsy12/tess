import api from './client';

export interface UserPublic {
  id: number;
  username: string;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
  created_at?: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: 'admin' | 'kunde' | 'analyse';
  kundenr?: string | null;
  actionKey?: string;
}

export interface UsersPaginatedResponse {
  data: UserPublic[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const usersApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<UsersPaginatedResponse>('/users', { params }),
  getById: (id: number) => api.get<UserPublic>(`/users/${id}`),
  create: (data: CreateUserPayload) => api.post<UserPublic>('/users', data),
  update: (id: number, data: UpdateUserPayload) => api.put<UserPublic>(`/users/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/users/${id}`),
};
