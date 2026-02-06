import api from './client';

export const suggestionsApi = {
  search: (q: string) => api.get('/suggestions/search', { params: { q } }),
};
