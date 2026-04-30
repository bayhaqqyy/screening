import { api } from './api';

export const marketService = {
  getOverview: () => api.get('/market/overview'),
  getTopMovers: (type = 'gainers') => api.get(`/market/top-movers?type=${type}`),
  getSectors: () => api.get('/market/sectors'),
  getStatus: () => api.get('/market/status'),
};
