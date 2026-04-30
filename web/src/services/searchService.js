import { api } from './api';

export const searchService = {
  searchStocks: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),
  getStockDetail: (ticker) => api.get(`/stock?ticker=${encodeURIComponent(ticker)}`),
};
