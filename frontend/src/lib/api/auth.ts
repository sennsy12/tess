import api from './client';

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  loginKunde: (kundenr: string, password: string) =>
    api.post('/auth/login-kunde', { kundenr, password }),
  verify: () => api.get('/auth/verify'),
};
