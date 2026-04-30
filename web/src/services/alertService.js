import { api } from './api';

export const alertService = {
  getAlerts: () => api.get('/alerts'),
  createAlert: (alertData) => api.post('/alerts', alertData),
  deleteAlert: (id) => api.delete(`/alerts?id=${encodeURIComponent(id)}`),
};
