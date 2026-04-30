import { api } from './api';

export const watchlistService = {
  getWatchlist: () => api.get('/watchlist'),
  addTicker: (ticker) => api.post('/watchlist', { ticker }),
  removeTicker: (ticker) => api.delete(`/watchlist?ticker=${encodeURIComponent(ticker)}`),
};
