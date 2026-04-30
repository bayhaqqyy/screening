import { api } from './api';

export const screenerService = {
  getResults: (strategy) => api.get(`/screener/${strategy}`),
};
