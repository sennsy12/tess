import api from './client';
import { UserPublic, CreateUserPayload, UpdateUserPayload } from '../../types/user';

export interface PaginatedUsersResponse {
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
    api.get<PaginatedUsersResponse>('/users', { params }),
  getById: (id: number) => api.get<UserPublic>(`/users/${id}`),
  create: (data: CreateUserPayload) => api.post<UserPublic>('/users', data),
  update: (id: number, data: UpdateUserPayload) => api.put<UserPublic>(`/users/${id}`, data),
  delete: (id: number, actionKey: string) =>
    api.delete<{ message: string }>(`/users/${id}`, { data: { actionKey } }),
};
