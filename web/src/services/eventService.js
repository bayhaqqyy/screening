import { api } from './api';

export const eventService = {
  getEvents: () => api.get('/events'),
};
