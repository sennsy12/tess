import api from './client';
import type { KundeProfile } from '../../types/customer';

export const customersApi = {
  getAll: () => api.get('/customers'),
  getOne: (kundenr: string) => api.get(`/customers/${kundenr}`),
  getMyProfile: () => api.get<KundeProfile>('/customers/me/profile'),
};
