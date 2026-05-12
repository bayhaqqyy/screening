import { api } from './api';

export const marketService = {
  getOverview: () => api.get('/market/overview'),
  getTopMovers: (type = 'gainers') => api.get(`/market/top-movers?type=${type}`),
  getSectors: () => api.get('/market/sectors'),
  getStatus: () => api.get('/market/status'),
  getBandarFlow: () => api.get('/market/bandar'),
  // Batch lookup used by V2 screener tables to pull bandar accumulation data
  // for every visible row in a single request.
  getBandarBatch: (tickers) => {
    const list = Array.isArray(tickers) ? tickers : [tickers];
    const unique = Array.from(new Set(list.filter(Boolean).map((t) => String(t).toUpperCase())));
    if (unique.length === 0) return Promise.resolve({});
    return api.get(`/bandar/batch?tickers=${encodeURIComponent(unique.join(','))}`);
  },
};
